import { CognitoIdentityServiceProvider, SSM, SecretsManager } from 'aws-sdk';

const cognito = new CognitoIdentityServiceProvider();

export async function cognitoCreateUser(options: {
  UserPoolId: string;
  Username: string;
  PasswordLength?: number;
  SecretId?: string;
  PasswordParameterName?: string;
}) {
  const { UserPoolId, Username } = options;

  await cognito.adminCreateUser({
    UserPoolId,
    Username,
  }).promise();

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

  await cognito.adminSetUserPassword({
    UserPoolId,
    Username,
    Password,
    Permanent: true,
  }).promise();
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
    const secretsmanager = new SecretsManager();

    const data = await secretsmanager.getRandomPassword({
      ExcludeCharacters: "+-=",
      PasswordLength,
    }).promise();

    const { RandomPassword } = data;
    if (!RandomPassword) {
      throw new Error(`secretsmanager.getRandomPassword() returns empty password`);
    }

    const ssm = new SSM();
    await ssm.putParameter({
      Name: PasswordParameterName,
      Value: RandomPassword,
      Overwrite: true,
    }).promise();

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
  const secretsmanager = new SecretsManager();

  const secretValue = await secretsmanager.getSecretValue({
    SecretId: secretId,
  }).promise();

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
    await cognito.adminDeleteUser(options).promise();
  } catch (err: any) {
    // Ignore UserNotFoundException
    if (err.code === "UserNotFoundException") {
      return;
    }

    // Otherwise, rethrow.
    throw err;
  }
}
