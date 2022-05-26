import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';
import { CodeBuild, Lambda, AWSError } from 'aws-sdk';
import { request } from 'https';
import { URL } from 'url';

const CREATE_FAILED_MARKER = "CREATE_FAILED";

export type HandlerResponse = undefined | {
  Data?: any;
  PhysicalResourceId?: string;
  Reason?: string;
  NoEcho?: boolean;
};

interface NodejsLayerVersionProperties {
  ServiceToken: string;
  Package: {
    Bucket: string;
    Key: string;
  };
  NpmArgs: ReadonlyArray<string>;
  DeleteLayer: boolean;
}

export async function handler(event: CloudFormationCustomResourceEvent): Promise<void> {
  console.log("Event: %j", event);

  try {
    switch (event.RequestType) {
      case 'Create':
        await createHandler(event);
        return;

      case 'Update':
        await updateHandler(event);
        return;

      case 'Delete':
        await deleteHandler(event);
        return;

      default:
        throw new Error(`Malformed event: Unknown request type ${(event as any).RequestType}`);
    }
  } catch (err) {
    console.error(err);

    await submitResponse({
      ...event,
      Status: 'FAILED',
      PhysicalResourceId: event.RequestType === 'Create' ? CREATE_FAILED_MARKER : event.PhysicalResourceId,
      Reason: (err as Error).stack || '',
    }, event);
  }
}

async function createHandler(event: CloudFormationCustomResourceCreateEvent): Promise<void> {
  const {
    StackId, LogicalResourceId, ResourceProperties,
  } = event;

  const props = ResourceProperties as NodejsLayerVersionProperties;

  validateProperties(props);

  const [, stackName] = StackId.split('/');
  const layerName = `${stackName}-${LogicalResourceId}`;

  return startBuildLayer(layerName, event);
}

async function updateHandler(event: CloudFormationCustomResourceUpdateEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
    OldResourceProperties,
  } = event;

  const props = ResourceProperties as NodejsLayerVersionProperties;
  const oldProps = OldResourceProperties as NodejsLayerVersionProperties;

  validateProperties(props);

  const [, , , , , , LayerName] = PhysicalResourceId.split(':');

  if (props.Package.Bucket === oldProps.Package.Bucket &&
    props.Package.Key === oldProps.Package.Key) {
    if (equalArrays(props.NpmArgs, oldProps.NpmArgs)) {
      return submitResponse({
        ...event,
        Status: 'SUCCESS',
        Reason: `The lambda layer ${LayerName} has not been modified`,
      }, event);
    }
  }

  return startBuildLayer(LayerName, event);
}

async function deleteHandler(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
  } = event;

  const props = ResourceProperties as NodejsLayerVersionProperties;

  if (PhysicalResourceId !== CREATE_FAILED_MARKER && props.DeleteLayer) {
    const lambda = new Lambda();

    const [, , , , , , LayerName, VersionNumber] = PhysicalResourceId.split(':');

    await lambda.deleteLayerVersion({
      LayerName,
      VersionNumber: parseInt(VersionNumber, 10),
    }).promise().catch((err: AWSError) => {
      if (err.code !== "ResourceNotFoundException") {
        throw err;
      }
    });
  }

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    Reason: `The lambda layer ${PhysicalResourceId} has been deleted`,
  }, event);
}

function equalArrays<T>(lhs: readonly T[], rhs: readonly T[]) {
  return lhs.length === rhs.length && !lhs.some((arg, index) => arg !== rhs[index]);
}

function validateProperties(props: NodejsLayerVersionProperties) {
  if (!props.Package) {
    throw new Error('Package must be specified');
  }

  if (!props.Package.Bucket) {
    throw new Error('Package.Bucket must be specified');
  }

  if (!props.Package.Key) {
    throw new Error('Package.Key must be specified');
  }

  if (!props.NpmArgs || !props.NpmArgs.length) {
    throw new Error('NpmArgs must be specified');
  }
}

async function startBuildLayer(layerName: string, event: CloudFormationCustomResourceEvent): Promise<void> {
  const { BUILDER_NAME } = process.env;

  if (!BUILDER_NAME) {
    throw new Error('The environment variable BUILDER_NAME must be specified');
  }

  const PhysicalResourceId = event.RequestType === 'Create' ? CREATE_FAILED_MARKER : event.PhysicalResourceId;

  const {
    StackId,
    LogicalResourceId,
    ResourceProperties,
    RequestId,
  } = event;

  const props = ResourceProperties as NodejsLayerVersionProperties;

  const codebuild = new CodeBuild();

  const startBuildData = await codebuild.startBuild({
    projectName: BUILDER_NAME,
    buildspecOverride: `
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: latest
    commands:
      - npm i -g npm
  build:
    commands:
      - >
        echo '{ "Status": "FAILED", "PhysicalResourceId": "${PhysicalResourceId}",
        "StackId": "${StackId}", "RequestId": "${RequestId}", "LogicalResourceId": "${LogicalResourceId}" }'
        > response.json
      - >
        aws s3 cp s3://${props.Package.Bucket}/${props.Package.Key} package.zip
      - unzip -x package.zip -d nodejs
      - npm ${props.NpmArgs.join(' ')} --prefix nodejs
      - zip -r code nodejs -x nodejs/package* nodejs/*.tgz
      - >
        aws lambda publish-layer-version --layer-name ${layerName}
        --description "$(jq -r '.name' nodejs/package.json)"
        --compatible-runtimes nodejs
        --zip-file fileb://code.zip
        > result.json
      - >
        echo "$(jq '.Status="SUCCESS" | .PhysicalResourceId="'$(jq -r '.LayerVersionArn' result.json)'"' response.json)"
        > response.json
    finally:
      - >
        curl -sS -X PUT -H 'content-type: application/json' -d "$(cat response.json)" '${event.ResponseURL}'
`,
  }).promise();

  const buildId = startBuildData.build?.id;

  if (!buildId) {
    throw new Error(`Missing build ID`);
  }

  for (; ;) {
    const { builds } = await codebuild.batchGetBuilds({
      ids: [buildId],
    }).promise();

    if (!builds) {
      throw new Error(`batchGetBuilds failed`);
    }

    switch (builds[0].buildStatus) {
      case "SUCCEEDED":
        return;
      case "IN_PROGRESS":
        await new Promise(resolve => {
          setTimeout(resolve, 10000);
        });
        continue;
      default:
        throw new Error(`Builder failed`);
    }
  }
}

async function submitResponse(response: CloudFormationCustomResourceResponse, event: CloudFormationCustomResourceEvent): Promise<void> {
  const url = new URL(event.ResponseURL);
  const body = JSON.stringify(response);

  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
    }, res => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`submitResponse failed: status code is ${res.statusCode}`));
      }
    });

    req
      .on('error', reject)
      .end(body);
  });
}
