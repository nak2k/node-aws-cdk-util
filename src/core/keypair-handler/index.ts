import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';
import { PutParameterCommand, ParameterNotFound, SSMClient, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import { request } from 'https';
import { URL } from 'url';
import { generateKeyPairSync } from "node:crypto";

const CREATE_FAILED_MARKER = "CREATE_FAILED";

const ssmClient = new SSMClient({});

export interface KeyPairProperties {
  Type: "rsa";
  ModulusLength: number;

  PrivateKey: {
    SsmParameter: string;
  };

  PublicKey: {
    SsmParameter: string;
  };
}

type KeyPairPropertiesWithServiceToken = KeyPairProperties & {
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
  const { ResourceProperties } = event;

  const props = ResourceProperties as KeyPairPropertiesWithServiceToken;

  validateProperties(props);

  await putKeyPairParameters(props);

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId: props.PrivateKey.SsmParameter,
  }, event);
}

async function updateHandler(event: CloudFormationCustomResourceUpdateEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
    OldResourceProperties,
  } = event;

  const props = ResourceProperties as KeyPairPropertiesWithServiceToken;
  const oldProps = OldResourceProperties as unknown as KeyPairProperties;

  validateProperties(props);

  if (props.Type === oldProps.Type &&
    props.ModulusLength === oldProps.ModulusLength &&
    props.PrivateKey.SsmParameter === oldProps.PrivateKey.SsmParameter &&
    props.PublicKey.SsmParameter === oldProps.PublicKey.SsmParameter) {
    return submitResponse({
      ...event,
      Status: 'SUCCESS',
      Reason: `This resource has not been modified`,
      PhysicalResourceId,
    }, event);
  }

  if (props.PrivateKey.SsmParameter !== oldProps.PrivateKey.SsmParameter) {
    if (props.PublicKey.SsmParameter === oldProps.PublicKey.SsmParameter) {
      return submitResponse({
        ...event,
        Status: 'FAILED',
        Reason: `PublicKey.SsmParameter must be changed at the same time as PrivateKey.SsmParameter`,
      }, event);
    }

    await putKeyPairParameters(props);
  } else {
    await putKeyPairParameters(props);

    if (props.PublicKey.SsmParameter !== oldProps.PublicKey.SsmParameter) {
      // Delete old public key
      await deleteParameter(oldProps.PublicKey.SsmParameter);
    }
  }

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    PhysicalResourceId: props.PrivateKey.SsmParameter,
  }, event);
}

async function deleteHandler(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  const {
    PhysicalResourceId,
    ResourceProperties,
  } = event;

  const props = ResourceProperties as KeyPairPropertiesWithServiceToken;

  await deleteParameter(props.PrivateKey.SsmParameter);
  await deleteParameter(props.PublicKey.SsmParameter);

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    Reason: `SSM parameters has been deleted`,
  }, event);
}

function validateProperties(props: KeyPairProperties) {
  if (!props.Type) {
    throw new Error('Type must be specified');
  }

  if (typeof (props.ModulusLength) !== "number") {
    throw new Error('ModulusLength must be a number');
  }

  if (!props.PrivateKey) {
    throw new Error('PrivateKey must be specified');
  }

  if (!props.PrivateKey.SsmParameter) {
    throw new Error('PrivateKey.SsmParameter must be specified');
  }

  if (!props.PublicKey) {
    throw new Error('PublicKey must be specified');
  }

  if (!props.PublicKey.SsmParameter) {
    throw new Error('PublicKey.SsmParameter must be specified');
  }
}

async function putKeyPairParameters(props: KeyPairPropertiesWithServiceToken, options: {
  privateKeyOverwrite?: boolean;
  publicKeyOverwrite?: boolean;
} = {}) {
  const keyPair = generateKeyPairSync(props.Type, {
    modulusLength: props.ModulusLength,
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
    Overwrite: options.privateKeyOverwrite,
  }));

  await ssmClient.send(new PutParameterCommand({
    Name: props.PublicKey.SsmParameter,
    Value: keyPair.publicKey,
    Type: "String",
    Overwrite: options.publicKeyOverwrite,
  }));
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

async function deleteParameter(parameterName: string) {
  await ssmClient.send(new DeleteParameterCommand({
    Name: parameterName,
  })).catch((err) => {
    if (!(err instanceof ParameterNotFound)) {
      throw err;
    }

    console.warn(`Parameter ${parameterName} does not exist`);
  });
}
