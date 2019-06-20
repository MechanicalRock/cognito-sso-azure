import  { sendCloudformationResponse, CLOUDFORMATION_FAILED, CLOUDFORMATION_SUCCESS } from "./send-cloudformation-response";

export interface CloudformationCustomResource {
    isPresent(thing: any): Promise<boolean>;
    create(thing: any): Promise<string>;
    update(thing: any): Promise<void>;
    delete(thing: any): Promise<void>;
}

export type IdempotentCustomResourceHandleConfig = {
    customResource: CloudformationCustomResource;
    failIfUnexpectedPresence: boolean;
    deleteToUpdate: boolean;
    ignoreDeleteFailure?: boolean;
}
export class IdempotentCustomResourceHandle {
    config: IdempotentCustomResourceHandleConfig;
    constructor(handlerConfig: IdempotentCustomResourceHandleConfig) {
        if ( ! (handlerConfig && handlerConfig.customResource )) {
            throw new Error('A custom resource handler is required');
        } else if ( handlerConfig.deleteToUpdate === false && handlerConfig.customResource.update === undefined ) {
            throw new Error('An update method must be defined when deleteToUpdate is false');
        }
        this.config = handlerConfig;
    }
    
    async processCustomResource(event: any, context: any) {
        let physicalResourceId: string = undefined;
        let customResource = this.config.customResource;
        console.log('EVENT');
        console.log(event);
        console.log('CONTEXT');
        console.log(context);
        console.log(`Request Type: ${event.RequestType}`);
        switch ( event.RequestType ) {
            case 'Create': 
                if ( ! await customResource.isPresent(event) ) {
                    console.log('no custom resource is present');
                    try {
                        physicalResourceId = await customResource.create(event);
                        if ( physicalResourceId ) {
                            event = {...event, physicalResourceId : physicalResourceId};
                        }                
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_SUCCESS);
                    } catch (e) {
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_FAILED, e.toString());
                    }
                } else if ( this.config.failIfUnexpectedPresence === true) {
                    await sendCloudformationResponse(event, context, CLOUDFORMATION_FAILED);
                } else {
                    console.log('custom resource already exists, doing nothing');
                    await sendCloudformationResponse(event, context, CLOUDFORMATION_SUCCESS);
                }
            break;

            case 'Update': 
                if ( this.config.deleteToUpdate === true ) {
                    if ( await this.config.customResource.isPresent(event) ) {
                        try {
                            await this.config.customResource.delete(event);
                        } catch (e) {
                            if ( this.config.failIfUnexpectedPresence === true ) {
                                await sendCloudformationResponse(event, context, CLOUDFORMATION_FAILED, e.toString());
                                break;
                            }
                        }
                    } else if ( this.config.failIfUnexpectedPresence === true ) {
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_FAILED);
                        break;
                    }
                    try {
                        physicalResourceId = await this.config.customResource.create(event);
                        if ( physicalResourceId ) {
                            event = {...event, physicalResourceId : physicalResourceId};
                        }
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_SUCCESS);
                    } catch (e) {
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_FAILED, e.toString());
                    }
                } else if ( this.config.customResource.update ) {
                    try {
                        await this.config.customResource.update(event);
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_SUCCESS);
                    } catch (e) {
                        await sendCloudformationResponse(event,context, CLOUDFORMATION_FAILED, e.toString());
                    }
                }                
            break;

            case 'Delete':
                if ( await this.config.customResource.isPresent(event) ) {
                    try {
                        await this.config.customResource.delete(event);
                        await sendCloudformationResponse(event, context, CLOUDFORMATION_SUCCESS);
                    } catch (e) {
                        let status = this.config.ignoreDeleteFailure === true ? CLOUDFORMATION_SUCCESS : CLOUDFORMATION_FAILED;
                        await sendCloudformationResponse(event, context, status, e.toString());
                    }
                } else {
                    console.log('nothing to delete');
                    let shouldFail = this.config.failIfUnexpectedPresence === true;
                    await sendCloudformationResponse(event, context, shouldFail ? CLOUDFORMATION_FAILED : CLOUDFORMATION_SUCCESS);
                }
            break;
        }
        console.log('custom resource ended');
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Completed',
                input: event,
            }),
        };
    }
}