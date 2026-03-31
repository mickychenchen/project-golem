'use strict';

const PageInteractor = require('../../core/PageInteractor');

class SendMessageUseCase {
    constructor(options = {}) {
        this.createInteractor = options.createInteractor || ((page, doctor) => new PageInteractor(page, doctor));
        this.isRecoverablePageClosedError = options.isRecoverablePageClosedError || (() => false);
        this.onSelectorHealed = options.onSelectorHealed || (async () => {});
        this.onRecoverableFailure = options.onRecoverableFailure || (async () => {});
    }

    async execute(input) {
        const {
            page,
            doctor,
            selectors,
            payload,
            isSystem,
            startTag,
            endTag,
            attachment,
        } = input;

        let interactor = this.createInteractor(page, doctor);

        try {
            return await interactor.interact(
                payload,
                selectors,
                isSystem,
                startTag,
                endTag,
                0,
                attachment
            );
        } catch (error) {
            if (error && error.message && error.message.startsWith('SELECTOR_HEALED:')) {
                const [, type, newSelector] = error.message.split(':');
                await this.onSelectorHealed(type, newSelector);
                return interactor.interact(
                    payload,
                    selectors,
                    isSystem,
                    startTag,
                    endTag,
                    1,
                    attachment
                );
            }

            if (this.isRecoverablePageClosedError(error)) {
                await this.onRecoverableFailure(error);
                interactor = this.createInteractor(input.page, doctor);
                return interactor.interact(
                    payload,
                    selectors,
                    isSystem,
                    startTag,
                    endTag,
                    0,
                    attachment
                );
            }

            throw error;
        }
    }
}

module.exports = SendMessageUseCase;
