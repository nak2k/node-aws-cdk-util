import { IAspect, IConstruct, Resource } from '@aws-cdk/core';
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs';
import { isFunction } from './Function';
import { isProject } from './Project';

interface LogGroupAspectProps {
  retention?: RetentionDays;
}

export class LogGroupAspect implements IAspect {
  private readonly retention?: RetentionDays;

  constructor(props: LogGroupAspectProps = {}) {
    this.retention = props.retention;
  }

  visit(node: IConstruct): void {
    if (!(node instanceof Resource)) {
      return;
    }

    const { stack, node: { id } } = node;

    if (isFunction(node)) {
      new LogGroup(stack, `${id}LogGroup`, {
        logGroupName: `/aws/lambda/${node.functionName}`,
        retention: this.retention,
      });
    } else if (isProject(node)) {
      new LogGroup(stack, `${id}LogGroup`, {
        logGroupName: `/aws/codebuild/${node.projectName}`,
        retention: this.retention,
      });
    }
  }
}
