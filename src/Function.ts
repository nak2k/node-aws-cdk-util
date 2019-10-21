interface Function {
  readonly functionName: string;
}

export function isFunction(arg: any): arg is Function {
  let module;

  try {
    module = require('@aws-cdk/aws-lambda');
  }
  catch (err) {
    return false;
  }

  if (!('Function' in module)) {
    return false;
  }

  return arg instanceof module.Function;
}
