import { Fn } from "aws-cdk-lib";

export class FnEx {
  /**
   * The tag function that is equivalent to call Fn.join() with empty delimiter.
   * 
   * @param strings 
   * @param values 
   */
  static concat(strings: TemplateStringsArray, ...values: string[]) {
    const partialLiterals = [...strings];
    const interleaved: string[] = [];

    for (interleaved.push(partialLiterals.shift()!); partialLiterals.length;) {
      interleaved.push(values.shift()!, partialLiterals.shift()!);
    }

    return Fn.join('', interleaved.filter(v => v));
  }
}
