import { Arn, Fn } from "aws-cdk-lib";
import { Architecture, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
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
   */
  static fromLWAAttributes(scope: Construct, id: string, attrs: LambdaWebAdapterAttributes) {
    const {
      region = "${AWS::Region}",
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

    const lwaLayerVersionArn = Arn.format({
      service: "lambda",
      region: region,
      account: "753240598075",
      resource: "layer",
      resourceName: `LambdaAdapterLayer${resourceNameArchitecture}:${resourceNameVersion}`,
    });

    return LayerVersion.fromLayerVersionArn(scope, id, Fn.sub(lwaLayerVersionArn));
  }
}
