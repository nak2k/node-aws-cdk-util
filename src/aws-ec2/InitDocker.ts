import { InitCommand, InitElement, InitPackage, InitService } from "aws-cdk-lib/aws-ec2";

export interface InitDockerOptions {
  /**
   * Users that are able to use Docker other than "root".
   */
  allowFromUsers?: string[];

  /**
   * Configuration to use amazon-ecr-credential-helper.
   */
  ecrCredentialHelperConfig?: {
    users: string[];
  };
}

/**
 * A configuration to install Docker.
 */
export class InitDocker {
  constructor(private options: InitDockerOptions) {
  }

  initElements() {
    const {
      allowFromUsers,
      ecrCredentialHelperConfig,
    } = this.options;

    const elements: InitElement[] = [
      InitPackage.yum('docker'),
      InitService.enable('docker'),
    ];

    for (const user of allowFromUsers ?? []) {
      if (user === "root") {
        throw new Error(`"root" must not contain in InitDockerOptions.allowFromUsers`);
      }

      elements.push(
        InitCommand.shellCommand(`usermod -G wheel,docker ${user}`)
      );
    }

    if (ecrCredentialHelperConfig) {
      elements.push(
        InitPackage.yum('amazon-ecr-credential-helper')
      );

      for (const user of ecrCredentialHelperConfig.users) {
        if (user === "root") {
          elements.push(
            InitCommand.shellCommand(
              `mkdir .docker && echo '{ "credsStore": "ecr-login" }' > .docker/config.json`,
              { cwd: "/root" }
            )
          );
        } else {
          elements.push(
            InitCommand.shellCommand(
              `mkdir .docker && echo '{ "credsStore": "ecr-login" }' > .docker/config.json && chown -R ${user} .docker`,
              { cwd: `/home/${user}` }
            )
          );
        }
      }
    }

    return elements;
  }
}
