import { PolicyStatement, IGrantable } from '@aws-cdk/aws-iam';

/**
 * Grant permissions for actions.
 * 
 * @param identity The principal.
 * @param actions List of actions that grant to the principal.
 * @param resources Resource ARNs.
 */
export function grantActions(identity: IGrantable, actions: string[], resources = ['*']) {
  identity.grantPrincipal.addToPrincipalPolicy(new PolicyStatement({
    actions,
    resources,
  }));
}
