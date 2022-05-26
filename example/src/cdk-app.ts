#!/usr/bin/env node
import { App, RemovalPolicy } from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { PreparedLogGroup } from "aws-cdk-util";
import { ApiGatewayExampleStack } from "./ApiGatewayExampleStack";
import { CognitoExampleStack } from "./CognitoExampleStack";
import { EventsToSlackExampleStack } from "./EventsToSlackExampleStack";
import { NodejsFunctionExampleStack } from "./NodejsFunctionExampleStack";
import { NodejsLayerExampleStack } from "./NodejsLayerExampleStack";
import { PreparedLogGroupExampleStack } from "./PreparedLogGroupExampleStack";

export const app = new App();

new ApiGatewayExampleStack(app, `ApiGatewayExampleStack`);
new CognitoExampleStack(app, `CognitoExampleStack`);
new EventsToSlackExampleStack(app, `EventsToSlackExampleStack`);
new NodejsFunctionExampleStack(app, `NodejsFunctionExampleStack`);
new NodejsLayerExampleStack(app, `NodejsLayerExampleStack`);
new PreparedLogGroupExampleStack(app, `PreparedLogGroupExampleStack`);

PreparedLogGroup.of(app).apply({
  removalPolicy: RemovalPolicy.DESTROY,
  retention: RetentionDays.FIVE_DAYS,
});
