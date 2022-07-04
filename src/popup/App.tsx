import React, { useCallback, useState } from 'react';
import { hot } from 'react-hot-loader';
import { str2ab, bufferToBase64URLString } from './helpers';
import * as browser from 'webextension-polyfill';

import './style.css';

const App = () => {
    const webauthnCreate = useCallback(() => {
        navigator.credentials
            .create({
                publicKey: {
                    challenge: str2ab('a1da16e81c0bdd098a04a91f853076b3785aa915ff07c1acc294e7a5d63946bc'),
                    rp: {
                        name: 'Example CORP'
                        // An rpID is not necessary but can be used
                        // id: '6e852fa4-0e10-4e6e-89d9-0330a4279f6f' // firefox uuid
                        // id: 'nhnjjlokanokjhheekkcgoiblhljealo' // chrom id
                    },
                    user: {
                        id: new Uint8Array(16),
                        name: 'john.p.smith@example.com',
                        displayName: 'John P. Smith'
                    },
                    pubKeyCredParams: [
                        {
                            type: 'public-key',
                            alg: -7
                        }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'cross-platform',
                        requireResidentKey: true,
                        userVerification: 'discouraged'
                    }
                }
            })
            .then((newCredentialInfo: any) => {
                const { id, rawId, response, type } = newCredentialInfo;

                // Convert values to base64 to make it easier to send back to the server
                const credentialJSON = {
                    id,
                    rawId: bufferToBase64URLString(rawId),
                    response: {
                        attestationObject: bufferToBase64URLString(response.attestationObject),
                        clientDataJSON: bufferToBase64URLString(response.clientDataJSON)
                    },
                    type,
                    clientExtensionResults: newCredentialInfo.getClientExtensionResults()
                };

                console.log(credentialJSON);
                setCreateResponse(JSON.stringify(credentialJSON, null, 4));
            })
            .catch(function (err) {
                // Deal with any error properly
                console.error(err);
            });
    }, []);

    const webauthnGet = useCallback(() => {
        navigator.credentials
            .get({
                publicKey: {
                    challenge: str2ab('a1da16e81c0bdd098a04a91f853076b3785aa915ff07c1acc294e7a5d63946bc'),
                    userVerification: 'preferred'
                }
            })
            .then((credential: any) => {
                const { id, rawId, response, type } = credential;

                let userHandle = undefined;
                if (response.userHandle) {
                    userHandle = bufferToBase64URLString(response.userHandle);
                }

                const assertion = {
                    id,
                    rawId: bufferToBase64URLString(rawId),
                    response: {
                        authenticatorData: bufferToBase64URLString(response.authenticatorData),
                        clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
                        signature: bufferToBase64URLString(response.signature),
                        userHandle
                    },
                    type,
                    clientExtensionResults: credential.getClientExtensionResults()
                };

                console.log(assertion);
                setGetResponse(JSON.stringify(assertion, null, 4));
            })
            .catch(function (err) {
                // Deal with any error properly
                console.error(err);
            });
    }, []);

    const [createResponse, setCreateResponse] = useState('...');
    const [getResponse, setGetResponse] = useState('...');

    const webauthnAuto = useCallback(() => {
        let authenticator = {
            protocol: 'ctap2',
            transport: 'usb',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true
        };
        browser.tabs.getCurrent().then((tab) => {
            let tabId = tab.id;
            chrome.debugger.attach({ tabId }, '1.3', () => {
                if (browser.runtime.lastError) {
                    console.error(browser.runtime.lastError.message);
                    return;
                }
                chrome.debugger.sendCommand({ tabId }, 'WebAuthn.enable', {}, () => {
                    chrome.debugger.sendCommand(
                        { tabId },
                        'WebAuthn.addVirtualAuthenticator',
                        { options: authenticator },
                        (response: any) => {
                            if (browser.runtime.lastError) {
                                console.error(browser.runtime.lastError.message);
                                return;
                            }
                            console.log(response);

                            webauthnCreate();
                            // chrome.debugger.detach({ tabId }, () => {});
                        }
                    );
                });
            });
        });
    }, []);

    // chrome.debugger.onDetach.addListener((source) => {
    //     if (source.tabId == tabId) {
    //         displayEnabled(false);
    //     }
    // });

    return (
        <div className="container">
            <h1>WebAuthn in Extension - Playground</h1>

            <button onClick={webauthnAuto}>Emulate key</button>

            <hr />

            <button onClick={webauthnCreate}>Create credential (signup)</button>

            <br />

            <button onClick={webauthnGet}>Get credential (login)</button>

            <hr />

            <h3>Create Response (attestation):</h3>
            <pre className="code-block">{createResponse}</pre>
            <a
                href={'https://debugger.simplewebauthn.dev/?attestation=' + btoa(createResponse)}
                target="_blank"
                rel="noreferrer"
            >
                Open debugger
            </a>

            <h3>Get Response (assertion):</h3>
            <pre className="code-block">{getResponse}</pre>
            <a
                href={
                    'https://debugger.simplewebauthn.dev/?assertion=' +
                    btoa(getResponse) +
                    '&attestation=' +
                    btoa(createResponse)
                }
                target="_blank"
                rel="noreferrer"
            >
                Open debugger
            </a>
        </div>
    );
};

export default hot(module)(App);
