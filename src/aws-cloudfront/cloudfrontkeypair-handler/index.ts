import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';
import { DeleteParametersCommand, GetParameterCommand, PutParameterCommand, ResourceNotFoundException, SSMClient } from '@aws-sdk/client-ssm';
import { CloudFrontClient, CreatePublicKeyCommand, DeletePublicKeyCommand } from "@aws-sdk/client-cloudfront";
import { request } from 'https';
import { URL } from 'url';
import { generateKeyPairSync } from "node:crypto";
import { createPublicKey } from "crypto";

const CREATE_FAILED_MARKER = "CREATE_FAILED";

const ssmClient = new SSMClient({});
const cloudfrontClient = new CloudFrontClient({});

export interface CloudFrontKeyPairProperties {
  PrivateKey: {
    SsmParameter: string;
  };
}

type CloudFrontKeyPairPropertiesWithServiceToken = CloudFrontKeyPairProperties & {
  ServiceToken: string;
};

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
      Reason: (err as Error).stack ?? '',
    }, event);
  }
}

async function createHandler(event: CloudFormationCustomResourceCreateEvent): Promise<void> {
  const { ResourceProperties, LogicalResourceId } = event;

  const props = ResourceProperties as CloudFrontKeyPairPropertiesWithServiceToken;

  validateProperties(props);

  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  });

  await ssmClient.send(new PutParameterCommand({
    Name: props.PrivateKey.SsmParameter,
    Value: keyPair.privateKey,
    Type: "SecureString",
  }));

  const publicKeyOutput = await cloudfrontClient.send(new CreatePublicKeyCommand({
    PublicKeyConfig: {
      CallerReference: LogicalResourceId,
      Name: LogicalResourceId,
      EncodedKey: keyPair.publicKey,
    },
  }));

  if (!publicKeyOutput.PublicKey?.Id) {
    throw new Error("PublicKey.Id is not returned from CloudFront API");
  }

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId: props.PrivateKey.SsmParameter,
    Data: {
      PublicKeyId: publicKeyOutput.PublicKey.Id,
    },
  }, event);
}

async function updateHandler(event: CloudFormationCustomResourceUpdateEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
    OldResourceProperties,
    LogicalResourceId,
  } = event;

  const props = ResourceProperties as CloudFrontKeyPairPropertiesWithServiceToken;
  const oldProps = OldResourceProperties as CloudFrontKeyPairProperties;

  validateProperties(props);

  if (props.PrivateKey.SsmParameter === oldProps.PrivateKey.SsmParameter) {
    return submitResponse({
      ...event,
      Status: 'SUCCESS',
      Reason: `This resource has not been modified`,
      PhysicalResourceId,
    }, event);
  }

  const getParameterOutput = await ssmClient.send(new GetParameterCommand({
    Name: oldProps.PrivateKey.SsmParameter,
    WithDecryption: true,
  }));

  if (!getParameterOutput.Parameter?.Value) {
    throw new Error(`Private key is not found in SSM parameter: ${oldProps.PrivateKey.SsmParameter}`);
  }

  const privateKey = getParameterOutput.Parameter.Value;

  await ssmClient.send(new PutParameterCommand({
    Name: props.PrivateKey.SsmParameter,
    Value: privateKey,
    Type: "SecureString",
  }));

  const publicKey = createPublicKey(privateKey).export({
    type: 'spki',
    format: 'pem',
  }).toString();

  const publicKeyOutput = await cloudfrontClient.send(new CreatePublicKeyCommand({
    PublicKeyConfig: {
      CallerReference: LogicalResourceId,
      Name: LogicalResourceId,
      EncodedKey: publicKey,
    },
  }));

  if (!publicKeyOutput.PublicKey?.Id) {
    throw new Error("PublicKey.Id is not returned from CloudFront API");
  }

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId: props.PrivateKey.SsmParameter,
    Data: {
      PublicKeyId: publicKeyOutput.PublicKey.Id,
    },
  }, event);
}

async function deleteHandler(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
  } = event;

  const props = ResourceProperties as CloudFrontKeyPairPropertiesWithServiceToken;

  if (PhysicalResourceId === CREATE_FAILED_MARKER) {
    return submitResponse({
      ...event,
      Status: 'SUCCESS',
      Reason: `Do nothing because the resource creation has been failed`,
    }, event);
  }

  await ssmClient.send(new DeleteParametersCommand({
    Names: [
      props.PrivateKey.SsmParameter,
    ],
  })).catch((err) => {
    if (!(err instanceof ResourceNotFoundException)) {
      throw err;
    }
  });

  await cloudfrontClient.send(new DeletePublicKeyCommand({
    Id: PhysicalResourceId,
  })).catch((err) => {
    if (!(err instanceof ResourceNotFoundException)) {
      throw err;
    }
  })

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    Reason: `SSM parameter and CloudFront public key has been deleted`,
  }, event);
}

function validateProperties(props: CloudFrontKeyPairProperties) {
  if (!props.PrivateKey) {
    throw new Error('PrivateKey must be specified');
  }

  if (!props.PrivateKey.SsmParameter) {
    throw new Error('PrivateKey.SsmParameter must be specified');
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
