const mockCfnResponse: jest.Mock = jest.fn();
jest.mock('../send-cloudformation-response', () => ({
    sendCloudformationResponse: mockCfnResponse
}))

import {  IdempotentCustomResourceHandle, CloudformationCustomResource, IdempotentCustomResourceHandleConfig } from "../cloudformation-custom-resource";
import { CLOUDFORMATION_FAILED, CLOUDFORMATION_SUCCESS } from "../send-cloudformation-response";

describe('validation of configuration', () => {
    it('should throw an error when deleteToUpdate is false and no update method defined', () => {
        try {
            new IdempotentCustomResourceHandle({deleteToUpdate: false, 
                customResource: { update: undefined } as CloudformationCustomResource} as IdempotentCustomResourceHandleConfig)
            fail();
        } catch (e) {
            expect(e.toString()).toBe('Error: An update method must be defined when deleteToUpdate is false');
        }
    });

    it('should throw an error when no appropriate configuration is supplied', () => {
        try {
            new IdempotentCustomResourceHandle({} as IdempotentCustomResourceHandleConfig);
            fail();
        } catch (e) {
            expect(e.toString()).toBe('Error: A custom resource handler is required');
        }
    });
});

describe('default idempotent custom resource handler - fail if present already', () => {
    mockCfnResponse.mockResolvedValue({});
    let handler: IdempotentCustomResourceHandle;
    let customResource: CloudformationCustomResource;

    beforeEach( () => {
        mockCfnResponse.mockClear();
        customResource = createCustomResource();
        handler = new IdempotentCustomResourceHandle({ 
            failIfUnexpectedPresence: true, 
            customResource: customResource, 
            deleteToUpdate: undefined
        });
    });

    it('should fail on create if resource is present', async (done) => {
        const event = { RequestType: 'Create'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED);
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(0);
        done();
    });

    it('should try to create if resource is not present', async(done) => {
        const event = { RequestType: 'Create'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);        
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);        
        done();
    });

    it('should fail if create fails', async () => {
        const event = { RequestType: 'Create'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        const create = (customResource.create as jest.Mock);
        create.mockRejectedValue('Oh no this is bad');
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(create).toBeCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);        
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED,'Oh no this is bad');        
    })

    it('should propagate new physical resource identifiers', async () => {
        const event = { RequestType: 'Create'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        const create = (customResource.create as jest.Mock);
        create.mockResolvedValue('physicalResourceId');
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(create).toBeCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);       
        expect(mockCfnResponse.mock.calls[0][0].physicalResourceId).toBe('physicalResourceId')
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS); 
    });
});

describe('default idempotent custom resource handler - no fail if not present', () => {
    mockCfnResponse.mockResolvedValue({});
    let handler: IdempotentCustomResourceHandle;
    let customResource: CloudformationCustomResource;

    beforeEach( () => {
        mockCfnResponse.mockClear();
        customResource = createCustomResource();
        handler = new IdempotentCustomResourceHandle({ 
            failIfUnexpectedPresence: false, 
            customResource: customResource, 
            deleteToUpdate: undefined
        });
    });

    it('should not fail when resource already exists', async(done) => {
        const event = { RequestType: 'Create'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(0);
        done();
    })
});

describe('default idempotent custom resource handler - delete to update', () => {
    mockCfnResponse.mockResolvedValue({});
    let handler: IdempotentCustomResourceHandle;
    let customResource: CloudformationCustomResource;

    beforeEach( () => {
        mockCfnResponse.mockClear();
        customResource = createCustomResource();
        handler = new IdempotentCustomResourceHandle({ 
            failIfUnexpectedPresence: false, 
            customResource: customResource, 
            deleteToUpdate: true
        });
    });

    it('should fail when delete to update is true, fail on unexpected presence is true, and resource is NOT present ', async (done) => {
        handler.config.failIfUnexpectedPresence = true;
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED);
        const doDelete = (customResource.delete as jest.Mock);
        expect(doDelete).toBeCalledTimes(0)
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(0);
        done();
    });
    
    it('should fail when delete to update is true, fail on ... is false, and delete operation fails', async(done) => {
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        const doDelete = (customResource.delete as jest.Mock);
        doDelete.mockImplementation( () => { throw new Error('oh no')});
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED, 'Error: oh no');
        expect(doDelete).toBeCalledTimes(1)
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(0);
        done();
    });

    it('should succeed when delete to update is true, fail on unexpected presence is false,  and resource is NOT present', async (done) => {
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        const doDelete = (customResource.delete as jest.Mock);
        expect(doDelete).toBeCalledTimes(0)
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(1);
        done();
    })

    it('should succeed when delete to update is true, fail on unexpected presence is false,  and resource IS present', async (done) => {
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        const doDelete = (customResource.delete as jest.Mock);
        expect(doDelete).toBeCalledTimes(1)
        const create = (customResource.create as jest.Mock);
        expect(create).toBeCalledTimes(1);
        done();
    })

});

describe('default idempotent custom resource handler - update in place', () => {
    mockCfnResponse.mockResolvedValue({});
    let handler: IdempotentCustomResourceHandle;
    let customResource: CloudformationCustomResource;

    beforeEach( () => {
        mockCfnResponse.mockClear();
        customResource = createCustomResource();
        handler = new IdempotentCustomResourceHandle({ 
            failIfUnexpectedPresence: false, 
            customResource: customResource, 
            deleteToUpdate: false
        });
    });

    it('should send success when update in place is called successfully', async (done) => {
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(0);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        const doUpdate = (customResource.update as jest.Mock);
        expect(doUpdate).toBeCalledTimes(1)
        done();
    });

    it('should send failed when update in place fails', async (done) => {
        const event = { RequestType: 'Update'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        const doUpdate = (customResource.update as jest.Mock);
        doUpdate.mockImplementation( () => { throw new Error('oh no')});
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(0);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED, 'Error: oh no');
        expect(doUpdate).toBeCalledTimes(1)
        done();
    });
});


describe('default idempotent custom resource handler - delete', () => {
    let handler: IdempotentCustomResourceHandle;
    let customResource: CloudformationCustomResource;

    beforeEach( () => {
        mockCfnResponse.mockClear();
        customResource = createCustomResource();
        handler = new IdempotentCustomResourceHandle({ 
            failIfUnexpectedPresence: false, 
            customResource: customResource, 
            deleteToUpdate: false
        });
    });

    it('should succeed when resource is present and deleted', async(done) => {
        const event = { RequestType: 'Delete'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        const doDelete = (customResource.delete as jest.Mock);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        expect(doDelete).toBeCalledTimes(1)
        done();
    });

    it('should fail when resource is present but delete operation fails', async (done) => {
        const event = { RequestType: 'Delete'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => true);
        const doDelete = (customResource.delete as jest.Mock);
        doDelete.mockImplementation( () => { throw new Error('oh no')});

        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED, 'Error: oh no');
        expect(doDelete).toBeCalledTimes(1)
        done();
    });

    it('should fail when resource does not exist and fail if unexpected presence = true', async (done) => {
        handler.config.failIfUnexpectedPresence = true;
        const event = { RequestType: 'Delete'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        const doDelete = (customResource.delete as jest.Mock);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_FAILED);
        expect(doDelete).toBeCalledTimes(0)
        done();
    });

    it('should succeed when resource does not exist and fail if unexpected presence = false', async(done) => {
        const event = { RequestType: 'Delete'};
        const isPresent = (customResource.isPresent as jest.Mock);
        isPresent.mockImplementation( () => false);
        const doDelete = (customResource.delete as jest.Mock);
        await handler.processCustomResource(event, {}); 

        expect(isPresent).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledTimes(1);
        expect(mockCfnResponse).toHaveBeenCalledWith( expect.anything() , expect.anything(), CLOUDFORMATION_SUCCESS);
        expect(doDelete).toBeCalledTimes(0)
        done();
    });
});

function createCustomResource() {
    return {
        isPresent: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    };
}