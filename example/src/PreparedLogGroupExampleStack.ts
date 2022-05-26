import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { DefaultEnvStack } from "aws-cdk-util";
import { Construct } from "constructs";

export class PreparedLogGroupExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `aws-cdk-util example`,
    });

    new Function(this, 'Function', {
      code: Code.fromAsset(__dirname + '/handler'),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_16_X,
    });
  }
}
