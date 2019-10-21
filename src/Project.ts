interface Project {
  readonly projectName: string;
}

export function isProject(arg: any): arg is Project {
  let module;

  try {
    module = require('@aws-cdk/aws-codebuild');
  }
  catch (err) {
    return false;
  }

  if (!('Project' in module)) {
    return false;
  }

  return arg instanceof module.Project;
}
