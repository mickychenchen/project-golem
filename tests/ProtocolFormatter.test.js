const ProtocolFormatter = require('../src/services/ProtocolFormatter');

describe('ProtocolFormatter', () => {
    test('generateReqId should return a short string', () => {
        const id = ProtocolFormatter.generateReqId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeLessThanOrEqual(4);
    });

    test('buildEnvelope should wrap text correctly', () => {
        const text = "Hello";
        const reqId = "test";
        const envelope = ProtocolFormatter.buildEnvelope(text, reqId);
        expect(envelope).toContain('[[BEGIN:test]]');
        expect(envelope).toContain('[[END:test]]');
        expect(envelope).toContain('Hello');
    });

    test('buildEnvelope should include observer prompt when specified', () => {
        const text = "Hello";
        const reqId = "test";
        const envelope = ProtocolFormatter.buildEnvelope(text, reqId, { 
            isObserver: true, 
            interventionLevel: 'PROACTIVE' 
        });
        expect(envelope).toContain('[GOLEM_OBSERVER_PROTOCOL]');
        expect(envelope).toContain('PROACTIVE OBSERVER MODE');
    });

    test('compress should remove leading/trailing whitespace and empty lines', () => {
        const input = "  line1  \n\n  line2  ";
        const output = ProtocolFormatter.compress(input);
        expect(output).toBe("line1\nline2");
    });
});
