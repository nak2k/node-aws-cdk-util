import { DefaultEnvStack, NodejsFunction } from "aws-cdk-util";
import { Construct } from "constructs";

export class NodejsFunctionExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `aws-cdk-util example`,
    });

    new NodejsFunction(this, "Function", {
      packageDirectory: './lambda',
    });
  }
}
