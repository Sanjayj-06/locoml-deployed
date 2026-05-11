import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const codeString = `openapi: "3.0.0"
info:
  version: 1.0.0
  title: My API
servers:
  - url: http://127.0.0.1:8080
paths:
  /inference/batch:
    post:
      summary: Make a batch inference
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: The file to be uploaded
                model_id:
                  type: string
                  
      responses:
        '200':
          description: Successful operation
          content:
            application/json:
              schema:
                type: object
                properties:
                  result:
                    type: string
  /inference/single:
    post:
      summary: Make a single inference
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                user_input_values:
                  type: object
                model_id:
                  type: string
      responses:
        '200':
          description: Successful operation
          content:
            application/json:
              schema:
                type: object
                properties:
                  prediction:
                    type: string
`;

function OpenAPIComponent() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <SyntaxHighlighter language="yaml" style={solarizedlight}>
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

export default OpenAPIComponent;