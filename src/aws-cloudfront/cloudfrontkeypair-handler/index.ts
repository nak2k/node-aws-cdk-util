import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';
import { GetParameterCommand, PutParameterCommand, ParameterNotFound, SSMClient, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import { CloudFrontClient, CreatePublicKeyCommand, DeletePublicKeyCommand, GetPublicKeyCommand, NoSuchPublicKey } from "@aws-sdk/client-cloudfront";
import { request } from 'https';
import { URL } from 'url';
import { generateKeyPairSync } from "node:crypto";

const CREATE_FAILED_MARKER = "CREATE_FAILED";

const ssmClient = new SSMClient({});
const cloudfrontClient = new CloudFrontClient({});

export interface CloudFrontKeyPairProperties {
  PublicKey: {
    Name: string;
  };
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
      Name: props.PublicKey.Name,
      EncodedKey: keyPair.publicKey,
    },
  }));

  if (!publicKeyOutput.PublicKey?.Id) {
    throw new Error("PublicKey.Id is not returned from CloudFront API");
  }

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId: publicKeyOutput.PublicKey.Id,
  }, event);
}

async function updateHandler(event: CloudFormationCustomResourceUpdateEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
    OldResourceProperties,
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

  await renameParameter(oldProps.PrivateKey.SsmParameter, props.PrivateKey.SsmParameter);

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId,
  }, event);
}

async function deleteHandler(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
  } = event;

  const props = ResourceProperties as CloudFrontKeyPairPropertiesWithServiceToken;

  await ssmClient.send(new DeleteParameterCommand({
    Name: props.PrivateKey.SsmParameter,
  })).catch((err) => {
    if (!(err instanceof ParameterNotFound)) {
      throw err;
    }

    console.warn(`SSM parameter is not found: ${props.PrivateKey.SsmParameter}`);
  });

  const getPublicKeyOutput = await cloudfrontClient.send(new GetPublicKeyCommand({
    Id: PhysicalResourceId,
  })).catch((err) => {
    if (!(err instanceof NoSuchPublicKey)) {
      throw err;
    }

    console.warn(`CloudFront public key is not found: ${PhysicalResourceId}`);
  });

  if (getPublicKeyOutput) {
    await cloudfrontClient.send(new DeletePublicKeyCommand({
      Id: PhysicalResourceId,
      IfMatch: getPublicKeyOutput.ETag,
    })).catch((err) => {
      if (!(err instanceof NoSuchPublicKey)) {
        throw err;
      }

      console.warn(`CloudFront public key is not found: ${PhysicalResourceId}`);
    })
  }

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

async function renameParameter(oldParameterName: string, newParameterName: string) {
  const getParameterOutput = await ssmClient.send(new GetParameterCommand({
    Name: oldParameterName,
    WithDecryption: true,
  }));

  if (!getParameterOutput.Parameter?.Value) {
    throw new Error(`Private key is not found in SSM parameter: ${oldParameterName}`);
  }

  await ssmClient.send(new PutParameterCommand({
    Name: newParameterName,
    Value: getParameterOutput.Parameter.Value,
    Type: "SecureString",
  }));

  await ssmClient.send(new DeleteParameterCommand({
    Name: oldParameterName,
  }));
}
