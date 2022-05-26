import { RemovalPolicy } from "aws-cdk-lib";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { CognitoUserPoolUser, DefaultEnvStack } from "aws-cdk-util";
import { Construct } from "constructs";

export class CognitoExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `aws-cdk-util example`,
    });

    const userPool = new UserPool(this, 'userPool', {
      userPoolName: 'example',
      signInAliases: {
        username: true,
        email: true,
        phone: false,
        preferredUsername: true,
      },
      autoVerify: {
        email: true,
        phone: false,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CognitoUserPoolUser(this, 'cognitoUser', {
      userPool,
      username: "test",
      passwordStore: "ssm",
      passwordParameterName: "/CognitoExampleStack/cognitoUserPassword",
      providerOnly: false,
    });
  }
}
