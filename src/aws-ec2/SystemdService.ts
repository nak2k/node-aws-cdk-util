import { InitFile, InitService } from "aws-cdk-lib/aws-ec2";

export interface SystemdServiceOptions {
  serviceName: string;

  description?: string;
  requires?: string;
  after?: string;

  /**
   * @default simple
   */
  type?: "simple" | "forking" | "oneshot" | "dbus" | "notify";

  execStartPre?: string | string[];
  execStart?: string | string[];
  execStartPost?: string | string[];

  /**
   * @default control-group
   */
  killMode?: 'control-group' | 'mixed' | 'process' | 'none';

  /**
   * @default no
   */
  restart?: 'no' | 'always' | 'on-success' | 'on-failure' | 'on-abnormal' | 'on-abort' | 'on-watchdog';

  /**
    * @default 100ms
    */
  restartSec?: string;
}

export class SystemdService {
  constructor(private options: SystemdServiceOptions) {
  }

  file() {
    const { options } = this;

    const lines = [
      `[Unit]`,
      options.description ?? `Description=${options.description}`,
      options.requires ?? `Requires=${options.requires}`,
      options.after ?? `After=${options.after}`,
      ``,
      `[Service]`,
      options.type ?? `Type=${options.type}`,
      ...Array.prototype.concat(options.execStartPre ?? []).map(s => `ExecStartPre=${s}`),
      ...Array.prototype.concat(options.execStart ?? []).map(s => `ExecStart=${s}`),
      ...Array.prototype.concat(options.execStartPost ?? []).map(s => `ExecStartPost=${s}`),
      options.killMode ?? `KillMode=${options.killMode}`,
      options.restart ?? `Restart=${options.restart}`,
      options.restartSec ?? `RestartSec=${options.restartSec}`,
      ``,
      `[Install]`,
      `WantedBy=multi-user.target`,
    ];

    return InitFile.fromString(`/etc/systemd/system/${options.serviceName}.service`, lines.filter(line => line !== undefined).join('\n'));
  }

  enable() {
    return InitService.enable(this.options.serviceName);
  }
}
