import { Duration } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface EventsToSlackProps {
  /**
   * The URL of an Incoming Webhook.
   */
  webhookUrl: string;

  /**
   * Overwrite a channel that messages are sent to.
   */
  channel?: string;

  /**
   * Overwrite a channel that error messages are sent to.
   */
  errorChannel?: string;
}

export class EventsToSlack extends Construct {
  constructor(scope: Construct, id: string, props: EventsToSlackProps) {
    super(scope, id);

    const handler = new Function(this, "handler", {
      code: Code.fromAsset(`${__dirname}/handler`),
      handler: "index.handler",
      runtime: Runtime.NODEJS_14_X,
      environment: {
        SLACK_WEBHOOK_URL: props.webhookUrl,
        SLACK_CHANNEL: props.channel ?? "",
        SLACK_ERROR_CHANNEL: props.errorChannel ?? "",
      },
      timeout: Duration.seconds(30),
      initialPolicy: [
        new PolicyStatement({
          actions: ["logs:GetLogEvents"],
          resources: ["*"],
        }),
      ],
    });

    new Rule(this, 'rule', {
      eventPattern: {
        source: [
          'aws.codebuild',
          'aws.codepipeline',
          'aws.glue',
          'aws.ssm',
        ],
        detailType: [
          'CodeBuild Build State Change',
          'CodePipeline Pipeline Execution State Change',
          'Glue Job State Change',
          'EC2 Command Invocation Status-change Notification',
        ],
      },
      targets: [
        new LambdaFunction(handler),
      ],
    });

  }
}
