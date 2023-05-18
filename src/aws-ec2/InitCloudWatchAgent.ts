import { InitFile, InitPackage, InitService } from "aws-cdk-lib/aws-ec2";

export interface InitCloudWatchAgentOptions {
  config?: {
    fromFile: string;
  };
}

/**
 * A configuration to install CloudWatch Agent.
 */
export class InitCloudWatchAgent {
  constructor(private options: InitCloudWatchAgentOptions) {
  }

  InitElements() {
    const {
      config,
    } = this.options;

    return [
      InitPackage.yum("collectd"),
      InitService.enable("collectd"),
      InitPackage.yum("amazon-cloudwatch-agent"),
      ...(config ? [InitFile.fromFileInline("/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json", config.fromFile)] : []),
      InitService.enable("amazon-cloudwatch-agent"),
    ];
  }
}
