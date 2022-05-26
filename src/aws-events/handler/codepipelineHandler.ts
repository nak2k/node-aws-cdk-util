import { postSlackMessage } from './postSlackMessage';
import { COLOR_MAP } from './constants';
import { CodePipelineCloudWatchPipelineEvent } from 'aws-lambda';

export async function codepipelineHandler(event: CodePipelineCloudWatchPipelineEvent, _context: any) {
  const {
    time,
    region,
    detail: {
      pipeline,
      state,
    },
  } = event;

  const title = `Pipeline \`${pipeline}\` is ${state}`;

  await postSlackMessage({
    text: title,
    attachments: [
      {
        title,
        title_link: `https://${region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline}/view`,
        color: COLOR_MAP[state] || 'danger',
        ts: Date.parse(time) / 1000,
      },
    ],
  });
}
