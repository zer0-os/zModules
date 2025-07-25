import { ContractFactory, ErrorDescription } from "ethers";


export interface IContractDecoderInput {
  name : string;
  factory : ContractFactory;
}

// TODO utils: move this to the utilities repo, so it can be used for any system
export const decodeError = ({
  contractFactories,
  encodedError,
} : {
  contractFactories : Array<IContractDecoderInput>;
  encodedError : string;
}) : string => {
  for (const { name, factory } of contractFactories) {
    try {
      const decodedError = factory.interface.parseError(encodedError) as ErrorDescription;

      return `Result:\n${name}: ${decodedError.name}(${decodedError.args.join(", ")})\n`;
    } catch (e) {
      // Ignore errors that cannot be decoded
      // Skip and try next
    }
  }

  return "Result:\nUnknown custom error";
};
