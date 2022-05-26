import { TextMockIntegration } from "./TextMockIntegration";

export interface JSONMockIntegrationOptions {
  body: any;

  /**
   * The value of the content-type header.
   * 
   * @default application/json
   */
  contentType?: string;
}

export class JSONMockIntegration extends TextMockIntegration {
  constructor(options: JSONMockIntegrationOptions) {
    super({
      body: JSON.stringify(options.body),
      contentType: options.contentType ?? "application/json",
    });
  }
}
