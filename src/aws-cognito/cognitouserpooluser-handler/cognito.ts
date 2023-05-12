import { AdminCreateUserCommand, AdminDeleteUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient, UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider';
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { GetRandomPasswordCommand, GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const cognitoClient = new CognitoIdentityProviderClient({});

export async function cognitoCreateUser(options: {
  UserPoolId: string;
  Username: string;
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}) {
  const { UserPoolId, Username } = options;

  await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId,
    Username,
  }));

  await cognitoSetUserPassword(options).catch(err =>
    cognitoDeleteUser({
      UserPoolId,
      Username,
    }).finally(() => {
      // Rethrow the original exception regardless of whether the user deletion was successful or not.
      throw err;
    })
  );

  return Username;
}

export async function cognitoSetUserPassword(options: {
  UserPoolId: string;
  Username: string;
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}) {
  const Password = await getPassword(options);

  if (!Password) {
    return;
  }

  const { UserPoolId, Username } = options;

  await cognitoClient.send(new AdminSetUserPasswordCommand({
    UserPoolId,
    Username,
    Password,
    Permanent: true,
  }));
}

/**
 * Get a password from Secret Manager, or generate it.
 * 
 * If options.SecretId is specified, this function returns the password from Secret Manager.
 * 
 * If options.PasswordParameterName is specified, this function generates the password
 * by calling getRandomPassword() of Secret Manager, and store it with a specified parameter name
 * to Systems Manager Parameter Store.
 * 
 * Otherwise, return undefined.
 * 
 * @param options 
 * @returns 
 */
async function getPassword(options: {
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}): Promise<string | undefined> {
  const { PasswordLength, SecretId, PasswordParameterName } = options;

  if (SecretId) {
    return (await getSecret(SecretId)).password;
  } else if (PasswordParameterName) {
    const secretsmanagerClient = new SecretsManagerClient({});

    const data = await secretsmanagerClient.send(new GetRandomPasswordCommand({
      ExcludeCharacters: "+-=",
      PasswordLength,
    }));

    const { RandomPassword } = data;
    if (!RandomPassword) {
      throw new Error(`secretsmanager.getRandomPassword() returns empty password`);
    }

    const ssmClient = new SSMClient({});
    await ssmClient.send(new PutParameterCommand({
      Name: PasswordParameterName,
      Value: RandomPassword,
      Overwrite: true,
    }));

    return RandomPassword;
  } else {
    return;
  }
}

/**
 * Get a secret from Secret Manager.
 * 
 * @param secretId 
 * @returns 
 */
async function getSecret(secretId: string): Promise<{ password: string }> {
  const secretsmanagerClient = new SecretsManagerClient({});

  const secretValue = await secretsmanagerClient.send(new GetSecretValueCommand({
    SecretId: secretId,
  }));

  const { SecretString } = secretValue;
  if (!SecretString) {
    throw new Error(`The secret ${secretId} is empty`);
  }

  try {
    return JSON.parse(SecretString);
  } catch (err: any) {
    throw new Error(`The secret ${secretId} is invalid JSON: ${err.message}`);
  }
}

/**
 * Delete a cognito user.
 * 
 * If the user does not exist, do nothing.
 * 
 * @param options 
 * @returns 
 */
export async function cognitoDeleteUser(options: {
  UserPoolId: string;
  Username: string;
}) {
  try {
    await cognitoClient.send(new AdminDeleteUserCommand(options));
  } catch (err: any) {
    // Ignore UserNotFoundException
    if (err instanceof UserNotFoundException) {
      return;
    }

    // Otherwise, rethrow.
    throw err;
  }
}
