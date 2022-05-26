import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';
import { request } from 'https';
import { URL } from 'url';
import { cognitoCreateUser, cognitoDeleteUser } from "./cognito";

const CREATE_FAILED_MARKER = "CREATE_FAILED";

interface CognitoUserPoolUserProperties {
  ServiceToken: string;
  UserPoolId: string;
  Username: string;
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
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
  } catch (err: any) {
    console.error(err);

    await submitResponse({
      ...event,
      Status: 'FAILED',
      PhysicalResourceId: event.RequestType === 'Create' ? CREATE_FAILED_MARKER : event.PhysicalResourceId,
      Reason: err.stack,
    }, event);
  }
}

async function createHandler(event: CloudFormationCustomResourceCreateEvent): Promise<void> {
  const {
    ResourceProperties,
  } = event;

  const props = ResourceProperties as CognitoUserPoolUserProperties;

  validateProperties(props);

  const Username = await cognitoCreateUser(props);

  return submitResponse({
    ...event,
    Status: "SUCCESS",
    PhysicalResourceId: `${props.UserPoolId}/${Username}`,
    Data: {
      Username,
    },
  }, event);
}

async function updateHandler(event: CloudFormationCustomResourceUpdateEvent): Promise<void> {
  const {
    ResourceProperties,
    OldResourceProperties,
  } = event;

  const props = ResourceProperties as CognitoUserPoolUserProperties;
  const oldProps = OldResourceProperties as CognitoUserPoolUserProperties;

  validateProperties(props);

  if (props.UserPoolId === oldProps.UserPoolId &&
    props.Username === oldProps.Username &&
    props.PasswordLength === oldProps.PasswordLength &&
    props.PasswordParameterName === oldProps.PasswordParameterName &&
    props.SecretId === oldProps.SecretId) {
    return submitResponse({
      ...event,
      Status: 'SUCCESS',
      Reason: `The resource has not been modified`,
    }, event);
  }

  const Username = await cognitoCreateUser(props);

  return submitResponse({
    ...event,
    Status: "SUCCESS",
    PhysicalResourceId: `${props.UserPoolId}/${Username}`,
    Data: {
      Username,
    },
  }, event);
}

async function deleteHandler(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  const {
    PhysicalResourceId,
  } = event;

  if (PhysicalResourceId === CREATE_FAILED_MARKER) {
    return submitResponse({
      ...event,
      Status: 'SUCCESS',
      Reason: `The resource has not been created yet`,
    }, event);
  }

  const match = PhysicalResourceId.match(/^([^/]+)\/(.+)/);
  if (!match) {
    throw new Error(`Malformed physical resource ID ${PhysicalResourceId}`);
  }

  const UserPoolId = match[1];
  const Username = match[2];

  await cognitoDeleteUser({ UserPoolId, Username });

  return submitResponse({
    ...event,
    Status: 'SUCCESS',
    Reason: `The resource has been deleted`,
  }, event);
}

function validateProperties(props: CognitoUserPoolUserProperties) {
  if (!props.UserPoolId) {
    throw new Error('UserPoolId must be specified');
  }

  if (!props.UserPoolId.match(/[\w-]+_[0-9a-zA-Z]+/)) {
    throw new Error('UserPoolId is not matched the pattern [\\w-]+_[0-9a-zA-Z]+');
  }

  if (!props.Username) {
    throw new Error('Username must be specified');
  }

  const match = props.Username.match(/[^\p{L}\p{M}\p{S}\p{N}\p{P}]/u);
  if (match) {
    throw new Error(`Username has prohibited characters ${match}`);
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
