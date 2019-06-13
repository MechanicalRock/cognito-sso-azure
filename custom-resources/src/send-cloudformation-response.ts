import axios, { AxiosRequestConfig } from 'axios';

/* Copied largely from https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-function-code.html#cfn-lambda-function-code-cfnresponsemodule
 *
 */
export const CLOUDFORMATION_SUCCESS = 'SUCCESS';
export const CLOUDFORMATION_FAILED = 'FAILED';

export async function sendCloudformationResponse(event: any, context: any, status: string, reason?: string): Promise<void> {
    var responseBody = JSON.stringify({
        Status: status,
        Reason: reason ? reason : "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: event.physicalResourceId ? event.physicalResourceId :  context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        NoEcho: event.noEcho || false,
        Data: event.responseData
    });
    console.log(`send-cfn-response - ResponseBody: `);
    console.log(responseBody);
    try {
        await axios.put(event.ResponseURL, responseBody, {
            headers: {
                "content-type": "",
                "content-length": responseBody.length
            }
        } as AxiosRequestConfig);
    } catch (e) {
        console.log(`Failed to send cloudformation response: ${e.toString()}`)
    } finally {
        context.done();
    }    
}

export default sendCloudformationResponse;