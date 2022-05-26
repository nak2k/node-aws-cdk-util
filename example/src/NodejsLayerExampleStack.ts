import { SymlinkFollowMode } from "aws-cdk-lib";
import {
  Code,
  Function,
  Runtime
} from "aws-cdk-lib/aws-lambda";
import { DefaultEnvStack, NodejsLayerVersion } from "aws-cdk-util";
import { Construct } from "constructs";

export class NodejsLayerExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `aws-cdk-util example`,
    });

    const lambdaPath = "./lambda";

    //
    // Create the LayerVersion.
    //
    const providerOnly = false;
    const layer = new NodejsLayerVersion(this, "LayerVersion", {
      packageDirectory: lambdaPath,
      useLockFile: true,
      providerOnly,
    });

    if (providerOnly) {
      return;
    }

    //
    // Create the Lambda function.
    //
    new Function(this, "Function", {
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(lambdaPath, {
        exclude: ["package*.json", "node_modules", "tsconfig.json"],
        followSymlinks: SymlinkFollowMode.ALWAYS,
      }),
      handler: "index.handler",
      layers: [layer.layerVersion],
    });
  }
}
