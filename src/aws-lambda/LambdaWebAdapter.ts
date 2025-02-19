import { ArnFormat, Stack } from "aws-cdk-lib";
import { Architecture, Function, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { arch } from "os";

/**
 * The attributes for the Lambda Web Adapter layer.
 */
export interface LambdaWebAdapterAttributes {
  /**
   * The AWS region the Lambda Web Adapter layer is deployed to.
   * 
   * @default ${AWS::Region}
   */
  region?: string;

  /**
   * The architecture of the Lambda Web Adapter layer.
   * 
   * @default Architecture for the current machine.
   */
  architecture?: Architecture;

  /**
   * The runtime of the Lambda Web Adapter layer.
   * 
   * @default Runtime.NODEJS_20_X
   */
  runtime?: Runtime;
}

export class LambdaWebAdapter {
  /**
   * Creates a new Lambda Web Adapter layer.
   * 
   * @param scope 
   * @param id 
   * @param attrs 
   * @returns 
   * @deprecated Use `addToFunction` instead.
   */
  static fromLWAAttributes(scope: Construct, id: string, attrs: LambdaWebAdapterAttributes) {
    const {
      architecture = arch() === "arm64" ? Architecture.ARM_64 : Architecture.X86_64,
      runtime = Runtime.NODEJS_20_X,
    } = attrs;

    let resourceNameArchitecture: string;
    let resourceNameVersion: string;

    if (architecture === Architecture.ARM_64) {
      resourceNameArchitecture = "Arm64";
    } else if (architecture === Architecture.X86_64) {
      resourceNameArchitecture = "X86";
    } else {
      throw new Error(`Unsupported architecture ${architecture.name}`);
    }

    if (runtime === Runtime.NODEJS_20_X) {
      resourceNameVersion = "20";
    } else {
      throw new Error(`Unsupported runtime ${runtime.name}`);
    }

    const lwaLayerVersionArn = Stack.of(scope).formatArn({
      account: "753240598075",
      service: "lambda",
      resource: "layer",
      resourceName: `LambdaAdapterLayer${resourceNameArchitecture}:${resourceNameVersion}`,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });

    return LayerVersion.fromLayerVersionArn(scope, id, lwaLayerVersionArn);
  }

  /**
   * Adds the Lambda Web Adapter layer to the specified Lambda function.
   * 
   * @param handler 
   */
  static addToFunction(handler: Function) {
    const architecture = handler.architecture === Architecture.ARM_64 ? "Arm64" : "X86";

    const lwaLayerVersionArn = Stack.of(handler).formatArn({
      account: "753240598075",
      service: "lambda",
      resource: "layer",
      resourceName: `LambdaAdapterLayer${architecture}:24`,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });

    handler.addLayers(LayerVersion.fromLayerVersionArn(handler, "LambdaWebAdapter", lwaLayerVersionArn));
  }
}
