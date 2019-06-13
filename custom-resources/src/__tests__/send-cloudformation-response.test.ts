jest.mock('axios');
import axios, { AxiosResponse } from 'axios';
import sendCloudformationResponse from "../send-cloudformation-response";

const mockedAxios = axios as jest.Mocked<typeof axios>;
type Context = { done: any; }
describe('sending a cloudformation response', () => {
    let event: any;
    let context:Context;
    
    beforeEach(() => {
        mockedAxios.put.mockClear();
        event = { ResponseURL: 'https://localhost' };
        context = { done: jest.fn()};
        context.done.mockResolvedValue({});
    });
    
    it('should be able to send a cloudformation response', async (done) => {
        mockedAxios.put.mockResolvedValue( { } as AxiosResponse);
        await sendCloudformationResponse(event, context, 'STATUS');
        expect(mockedAxios.put).toHaveBeenCalledTimes(1);
        expect(mockedAxios.put).toHaveBeenCalledWith('https://localhost', expect.anything(), expect.anything());
        done();
    });

    it('should still call context.done() when put request fails', async (done) => {
        mockedAxios.put.mockRejectedValue( { error: 'Oh no'} );
        await sendCloudformationResponse(event, context, 'STATUS');
        expect(mockedAxios.put).toHaveBeenCalledTimes(1);
        const mockedContext = context as jest.Mocked<typeof context>;
        expect(mockedContext.done);
        done();
    });

    it('should propagate a physicalResourceId if one is set', async () => {
        event['physicalResourceId'] = 'my-resource-id';
        context['logStreamName'] = 'logstreamname';
        mockedAxios.put.mockResolvedValue( { } as AxiosResponse);
        await sendCloudformationResponse(event, context, 'STATUS');
        expect(mockedAxios.put).toHaveBeenCalledTimes(1);
        expect(mockedAxios.put).toHaveBeenCalledWith('https://localhost', expect.anything(), expect.anything());
        expect(JSON.parse(mockedAxios.put.mock.calls[0][1]).PhysicalResourceId).toBe('my-resource-id');
    });

    it('should use context log stream name if there is no physical resource id', async() => {
        context['logStreamName'] = 'logstreamname';
        mockedAxios.put.mockResolvedValue( { } as AxiosResponse);
        await sendCloudformationResponse(event, context, 'STATUS');
        expect(mockedAxios.put).toHaveBeenCalledTimes(1);
        expect(mockedAxios.put).toHaveBeenCalledWith('https://localhost', expect.anything(), expect.anything());
        expect(JSON.parse(mockedAxios.put.mock.calls[0][1]).PhysicalResourceId).toBe('logstreamname');
    });
});