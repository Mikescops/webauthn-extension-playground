import React, { useCallback, useState } from 'react';
import * as cbor from 'cbor-x';
import { hot } from 'react-hot-loader';
import {
    str2ab,
    bufferToBase64URLString,
    base64StringToBuffer,
    stringToBuffer,
    sha256,
    bufferToBase64String
} from './helpers';
import * as browser from 'webextension-polyfill';

import './style.css';

const App = () => {
    const challenge = str2ab('a1da16e81c0bdd098a04a91f853076b3785aa915ff07c1acc294e7a5d63946bc');

    const webauthnCreate = useCallback(() => {
        navigator.credentials
            .create({
                publicKey: {
                    challenge,
                    rp: {
                        name: 'Example CORP',
                        // An rpID is not necessary but can be used
                        // id: '6e852fa4-0e10-4e6e-89d9-0330a4279f6f' // firefox uuid
                        // id: 'nhnjjlokanokjhheekkcgoiblhljealo' // chrom id
                        id: 'chrome-extension://dnifbcdaadaoifdojfdjhimhdaaoomio'
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
                    challenge,
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

    const originals = navigator.credentials;

    const authenticatorId = 'ktqhYpBnABLsSad10uyGVYwT3UU4VYankL3qmX4VTGo'; // arbitrary
    const userHandle = base64StringToBuffer('AAAAAAAAAAAAAAAAAAAAAA'); // arbitrary

    const createClientData = (options: CredentialCreationOptions) => {
        return {
            type: 'webauthn.create',
            challenge: bufferToBase64URLString(options.publicKey?.challenge as ArrayBuffer),
            origin: 'chrome-extension://dnifbcdaadaoifdojfdjhimhdaaoomio',
            crossOrigin: false
        };
    };

    const getClientData = (options: CredentialRequestOptions) => {
        return {
            type: 'webauthn.get',
            challenge: bufferToBase64URLString(options.publicKey?.challenge as ArrayBuffer),
            origin: 'chrome-extension://dnifbcdaadaoifdojfdjhimhdaaoomio',
            crossOrigin: false
        };
    };

    const overrides: typeof navigator.credentials = {
        create: async (options: CredentialCreationOptions) => {
            console.log('create called');

            const rpId = 'chrome-extension://' + browser.runtime.id;
            const rpIdHash = await sha256(options.publicKey?.rp.id || rpId);
            const counter = new Uint8Array([0, 0, 0, 1]); // 32bit array or 4 8bit array
            const flags = new Uint8Array([0b01000101]); // 8bit array

            const aaguid = new Uint8Array(16); // 00000000-0000-0000-0000-000000000000
            const credentialID = base64StringToBuffer(authenticatorId);
            const credentialIdLength = new Uint8Array([0, credentialID.byteLength]);
            const credentialPublicKey = base64StringToBuffer(
                'pQECAyYgASFYINi05ym1geUVzC4xLKKLCcbkaCoc_Z04khjOfq9eMZ6XIlggf--HdAaXVRIGE1A6XgdukSADfxTAJnFuYsTpKyb0mcQ'
            );

            const attestedCredentialData = await new Blob([
                aaguid,
                credentialIdLength,
                credentialID,
                credentialPublicKey
            ]).arrayBuffer();

            const concatenated = await new Blob([rpIdHash, flags, counter, attestedCredentialData]).arrayBuffer();

            console.log(bufferToBase64String(concatenated));

            const attestationObject = {
                fmt: 'none',
                attStmt: {},
                authData: new Uint8Array(concatenated)
                // authData: base64StringToBuffer(
                //     'kBeGf8QpqZDBaE22HrGnxxuPnODqRAtj+L9iX71X1gNFAAAAAQAAAAAAAAAAAAAAAAAAAAAAIJLaoWKQZwAS7EmnddLshlWME91FOFWGp5C96pl+FUxqpQECAyYgASFYINi05ym1geUVzC4xLKKLCcbkaCoc/Z04khjOfq9eMZ6XIlggf++HdAaXVRIGE1A6XgdukSADfxTAJnFuYsTpKyb0mcQ='
                // )

                // {
                //     rpIdHash: 'kBeGf8QpqZDBaE22HrGnxxuPnODqRAtj-L9iX71X1gM',
                //     flags: {
                //         userPresent: true,
                //         userVerified: true,
                //         attestedData: true,
                //         extensionData: false
                //     },
                //     counter: 1,
                //     aaguid: '00000000-0000-0000-0000-000000000000',
                //     credentialID: 'ktqhYpBnABLsSad10uyGVYwT3UU4VYankL3qmX4VTGo',
                //     credentialPublicKey:
                //         'pQECAyYgASFYINi05ym1geUVzC4xLKKLCcbkaCoc_Z04khjOfq9eMZ6XIlggf--HdAaXVRIGE1A6XgdukSADfxTAJnFuYsTpKyb0mcQ',
                //     parsedCredentialPublicKey: {
                //         keyType: 'EC2 (2)',
                //         algorithm: 'ES256 (-7)',
                //         curve: 1,
                //         x: '2LTnKbWB5RXMLjEsoosJxuRoKhz9nTiSGM5-r14xnpc',
                //         y: 'f--HdAaXVRIGE1A6XgdukSADfxTAJnFuYsTpKyb0mcQ'
                //     }
                // }
            };

            const attestationObjectCBOR = cbor.encode(attestationObject);

            return new Promise((resolve: (param: any) => void) => {
                return resolve({
                    id: authenticatorId,
                    rawId: base64StringToBuffer(authenticatorId),
                    response: {
                        attestationObject: attestationObjectCBOR,
                        // attestationObject: base64StringToBuffer(
                        //     'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikkBeGf8QpqZDBaE22HrGnxxuPnODqRAtj-L9iX71X1gNFAAAAAQAAAAAAAAAAAAAAAAAAAAAAIJLaoWKQZwAS7EmnddLshlWME91FOFWGp5C96pl-FUxqpQECAyYgASFYINi05ym1geUVzC4xLKKLCcbkaCoc_Z04khjOfq9eMZ6XIlggf--HdAaXVRIGE1A6XgdukSADfxTAJnFuYsTpKyb0mcQ'
                        // ),
                        clientDataJSON: stringToBuffer(JSON.stringify(createClientData(options)))
                        // clientDataJSON: base64StringToBuffer(
                        //     'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiWVFBeEFHUUFZUUF4QURZQVpRQTRBREVBWXdBd0FHSUFaQUJrQURBQU9RQTRBR0VBTUFBMEFHRUFPUUF4QUdZQU9BQTFBRE1BTUFBM0FEWUFZZ0F6QURjQU9BQTFBR0VBWVFBNUFERUFOUUJtQUdZQU1BQTNBR01BTVFCaEFHTUFZd0F5QURrQU5BQmxBRGNBWVFBMUFHUUFOZ0F6QURrQU5BQTJBR0lBWXdBIiwib3JpZ2luIjoiY2hyb21lLWV4dGVuc2lvbjovL2RuaWZiY2RhYWRhb2lmZG9qZmRqaGltaGRhYW9vbWlvIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ'
                        // )
                    },
                    type: 'public-key',
                    getClientExtensionResults: () => {
                        return {};
                    }
                });
            });
        },
        get: async (options: CredentialRequestOptions) => {
            console.log('get called');

            // const authenticatorData = {
            //     rpIdHash: 'kBeGf8QpqZDBaE22HrGnxxuPnODqRAtj-L9iX71X1gM',
            //     flags: {
            //         userPresent: true,
            //         userVerified: true,
            //         attestedData: false,
            //         extensionData: false
            //     },
            //     counter: 2
            // };

            // see https://www.w3.org/TR/webauthn-2/#authenticator-data
            const rpId = 'chrome-extension://' + browser.runtime.id;
            const rpIdHash = await sha256(options.publicKey?.rpId || rpId);
            const counter = new Uint8Array([0, 0, 0, 2]); // 32bit array or 4 8bit array
            const flags = new Uint8Array([0b00000101]); // 8bit array

            const concatenated = await new Blob([rpIdHash, flags, counter]).arrayBuffer();

            return new Promise((resolve: (param: any) => void) => {
                return resolve({
                    id: authenticatorId,
                    rawId: base64StringToBuffer(authenticatorId),
                    response: {
                        authenticatorData: concatenated,
                        //authenticatorData: base64StringToBuffer('kBeGf8QpqZDBaE22HrGnxxuPnODqRAtj-L9iX71X1gMFAAAAAg'),
                        clientDataJSON: stringToBuffer(JSON.stringify(getClientData(options))),
                        // base64StringToBuffer(
                        //     'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiWVFBeEFHUUFZUUF4QURZQVpRQTRBREVBWXdBd0FHSUFaQUJrQURBQU9RQTRBR0VBTUFBMEFHRUFPUUF4QUdZQU9BQTFBRE1BTUFBM0FEWUFZZ0F6QURjQU9BQTFBR0VBWVFBNUFERUFOUUJtQUdZQU1BQTNBR01BTVFCaEFHTUFZd0F5QURrQU5BQmxBRGNBWVFBMUFHUUFOZ0F6QURrQU5BQTJBR0lBWXdBIiwib3JpZ2luIjoiY2hyb21lLWV4dGVuc2lvbjovL2RuaWZiY2RhYWRhb2lmZG9qZmRqaGltaGRhYW9vbWlvIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ'
                        // )
                        signature: base64StringToBuffer(
                            'MEQCIFgRtwjJt1fJX2TwEtGFRvZtDwqOf0sgT7FdIrGJzHooAiALRM8NYPVYTyVPHJEdVroLj51ikeNmvgOzyitWmLc68Q'
                        ),
                        userHandle
                    },
                    type: 'public-key',
                    getClientExtensionResults: () => {
                        return {};
                    }
                });
            });
        },
        preventSilentAccess: () => {
            return originals.preventSilentAccess();
        },
        store: (credential: Credential) => {
            return originals.store(credential);
        }
    };

    const webauthnHijack = useCallback(() => {
        Object.defineProperty(navigator, 'credentials', {
            value: overrides
        });
    }, []);

    return (
        <div className="container">
            <h1>WebAuthn in Extension - Playground</h1>

            <button onClick={webauthnAuto}>Emulate key</button>
            <button onClick={webauthnHijack}>Hijack WebAuthn</button>

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
