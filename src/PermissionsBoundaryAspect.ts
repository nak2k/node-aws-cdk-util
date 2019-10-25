import { ManagedPolicy, CfnRole, CfnUser } from '@aws-cdk/aws-iam';
import { IAspect, IConstruct, Stack } from '@aws-cdk/core';

export class PermissionsBoundaryAspect implements IAspect {
  id: string;
  managedPolicyName: string;

  constructor(scope: IConstruct, id: string, managedPolicyName: string) {
    this.id = id;
    this.managedPolicyName = managedPolicyName;

    scope.node.applyAspect(this);
  }

  visit(node: IConstruct): void {
    if (node instanceof CfnRole || node instanceof CfnUser) {
      node.permissionsBoundary = this.getPolicy(node).managedPolicyArn;
    }
  }

  private getPolicy(construct: IConstruct) {
    const stack = Stack.of(construct);

    const policy = stack.node.tryFindChild(this.id);

    if (!policy) {
      return ManagedPolicy.fromManagedPolicyName(stack, this.id, this.managedPolicyName);
    }

    if ('managedPolicyArn' in policy) {
      return policy;
    }

    throw new Error(`Construct ${this.id} must be an IManagedPolicy`);
  }
}
