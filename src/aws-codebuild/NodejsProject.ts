import { readFileSync } from 'fs';
import { URL } from 'url';
import {
  ProjectProps, Project, GitHubSourceProps, Source, FilterGroup, EventAction, LinuxBuildImage
} from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';

export interface NodejsProjectProps extends ProjectProps {
  /**
   * Whether to enable the webhook.
   * 
   * @default true
   */
  webhook?: boolean;
}

export class NodejsProject extends Project {
  constructor(scope: Construct, id: string, props: NodejsProjectProps = {}) {
    const gitHubSourceProps = NodejsProject.getGitHubSourcePropsFromPackageJson();
    const { webhook = true } = props;
    const {
      projectName,
      environment,
      source = Source.gitHub({
        ...gitHubSourceProps,
        webhook,
        webhookFilters: webhook ? [
          FilterGroup.inEventOf(EventAction.PUSH).andBranchIs('master'),
        ] : undefined,
      }),
    } = props;

    super(scope, id, {
      ...props,
      projectName: projectName || gitHubSourceProps.repo,
      source,
      environment: environment || {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
      },
    });
  }

  static getGitHubSourcePropsFromPackageJson(): GitHubSourceProps {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

    if (typeof pkg.repository !== 'object') {
      throw new Error('The repository in package.json must be an object');
    }

    if (typeof pkg.repository.url !== 'string') {
      throw new Error('The repository.url in package.json must be a valid URL');
    }

    let urlObj: URL;

    try {
      urlObj = new URL(pkg.repository.url);
    } catch (err) {
      throw new Error('The repository.url in package.json must be a valid URL');
    }

    if (urlObj.protocol === 'github:') {
      const [owner, repo] = urlObj.pathname.split('/');

      return {
        owner,
        repo,
      };
    } else if (urlObj.protocol == 'git+https:' && urlObj.hostname === 'github.com') {
      const [, owner, repo] = urlObj.pathname.replace(/\.git$/, '').split('/');

      return {
        owner,
        repo,
      };
    } else {
      throw new Error('Unknown location of GitHub repo. Perhaps, package.json is invalid');
    }
  }
}
