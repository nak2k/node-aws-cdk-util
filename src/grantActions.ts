import { PolicyStatement, IGrantable } from '@aws-cdk/aws-iam';

/**
 * Grant permissions for actions.
 * 
 * @param identity The principal.
 * @param actions 
 */
export function grantActions(identity: IGrantable, actions: string[]) {
  identity.grantPrincipal.addToPolicy(new PolicyStatement({
    actions,
    resources: ['*'],
  }));
}
