const SendMessageUseCase = require('../src/application/use-cases/SendMessageUseCase');

describe('SendMessageUseCase', () => {
    test('handles selector healed flow and retries once', async () => {
        const interact = jest.fn()
            .mockRejectedValueOnce(new Error('SELECTOR_HEALED:input:textarea'))
            .mockResolvedValueOnce({ text: 'ok', attachments: [], status: 'ENVELOPE_COMPLETE' });

        const onSelectorHealed = jest.fn();
        const useCase = new SendMessageUseCase({
            createInteractor: () => ({ interact }),
            onSelectorHealed,
        });

        const result = await useCase.execute({
            page: {},
            doctor: {},
            selectors: {},
            payload: 'payload',
            isSystem: false,
            startTag: '[S]',
            endTag: '[E]',
            attachment: null,
        });

        expect(onSelectorHealed).toHaveBeenCalledWith('input', 'textarea');
        expect(interact).toHaveBeenCalledTimes(2);
        expect(result.status).toBe('ENVELOPE_COMPLETE');
    });

    test('handles recoverable page closed error via recovery callback', async () => {
        const firstInteractor = {
            interact: jest.fn().mockRejectedValue(new Error('Target page, context or browser has been closed')),
        };
        const secondInteractor = {
            interact: jest.fn().mockResolvedValue({ text: 'retry-ok', attachments: [], status: 'ENVELOPE_COMPLETE' }),
        };

        const onRecoverableFailure = jest.fn();
        const useCase = new SendMessageUseCase({
            createInteractor: jest.fn()
                .mockReturnValueOnce(firstInteractor)
                .mockReturnValueOnce(secondInteractor),
            isRecoverablePageClosedError: (err) => /has been closed/i.test(String(err && err.message)),
            onRecoverableFailure,
        });

        const result = await useCase.execute({
            page: {},
            doctor: {},
            selectors: {},
            payload: 'payload',
            isSystem: false,
            startTag: '[S]',
            endTag: '[E]',
            attachment: null,
        });

        expect(onRecoverableFailure).toHaveBeenCalledTimes(1);
        expect(secondInteractor.interact).toHaveBeenCalledTimes(1);
        expect(result.text).toBe('retry-ok');
    });
});
