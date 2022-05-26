import { codebuildHandler } from './codebuildHandler';
import { codepipelineHandler } from './codepipelineHandler';
import { glueHandler } from './glueHandler';
import { ssmHandler } from './ssmHandler';
import { EventBridgeEvent } from 'aws-lambda';

export async function handler(event: EventBridgeEvent<"unknown", unknown>, context: any) {
  const { source } = event;

  if (source === "aws.codebuild") {
    await codebuildHandler(event as any, context);
  } else if (source === "aws.codepipeline") {
    await codepipelineHandler(event as any, context);
  } else if (source === "aws.glue") {
    await glueHandler(event as any, context);
  } else if (source === "aws.ssm") {
    await ssmHandler(event as any, context);
  } else {
    console.log(`Event source '${source}' is not supported`);
  }
}
