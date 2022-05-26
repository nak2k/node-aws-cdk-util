import { DefaultEnvStack, EventsToSlack } from "aws-cdk-util";
import { Construct } from "constructs";

export class EventsToSlackExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `aws-cdk-util example`,
    });

    new EventsToSlack(this, "eventsToSlack", {
      webhookUrl: "",
    });
  }
}
