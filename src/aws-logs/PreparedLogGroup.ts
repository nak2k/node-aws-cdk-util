import {
  Aspects, CfnResource, Fn, RemovalPolicy
} from "aws-cdk-lib";
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct, IConstruct } from "constructs";

export interface PreparedLogGroupApplyProps {
  removalPolicy?: RemovalPolicy;
  retention?: RetentionDays;
}

export class PreparedLogGroup {
  public static of(scope: IConstruct): PreparedLogGroup {
    return new PreparedLogGroup(scope);
  }

  private constructor(private readonly scope: IConstruct) {
  }

  public apply(props: PreparedLogGroupApplyProps = {}) {
    Aspects.of(this.scope).add({
      visit(construct) {
        if (!(construct instanceof CfnResource)) {
          return;
        }

        let logGroupPrefix: string;

        if (construct.cfnResourceType === 'AWS::Lambda::Function') {
          logGroupPrefix = '/aws/lambda/';
        } else if (construct.cfnResourceType === 'AWS::CodeBuild::Project') {
          logGroupPrefix = '/aws/codebuild/';
        } else {
          return;
        }

        const scope = PreparedLogGroup.findParentConstruct(construct);
        if (!scope) {
          throw new Error('Parent construct not found');
        }

        new LogGroup(scope, `${construct.node.id}LogGroup`, {
          logGroupName: Fn.join('', [logGroupPrefix, construct.ref]),
          ...props,
        });
      }
    });
  }

  private static findParentConstruct(construct: IConstruct): Construct | undefined {
    const { node } = construct;
    const scopes = [...node.scopes];

    scopes.pop();

    while (true) {
      const scope = scopes.pop();
      if (!scope) {
        return;
      }

      if (scope instanceof Construct) {
        return scope;
      }
    }
  }
}
