import type { WireguardConfig, WireguardPeer } from "../networkModel";
import { parseIpAddressModel } from "../ip";

const lineBreakRegExp = /\r\n|\n\r|\r|\n/;

const interfaceSectionLine = "[Interface]";
const peerSectionLine = "[Peer]";
const propertyLine = /^(\w+)\s*=\s*(.*)$/;

type SectionName = typeof interfaceSectionLine | typeof peerSectionLine;

type ParserType<T> = (value: string, existingValue: T | undefined) => T;

const unknownPropertyParser: ParserType<never> = () => {
  throw new Error(`Unknown property`);
};

const validateWgKey: ParserType<string> = (value, existingValue) => {
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) {
    throw new Error(`Invalid WireGuard key: not a valid base64 string`);
  }
  return defaultParser(value, existingValue);
};

const defaultParser: ParserType<any> = (value, existingValue) => {
  if (existingValue != null) {
    throw new Error(`Property cannot be specified multiple times!`);
  }
  return value;
};

const numberParser: ParserType<number> = (value, existingValue) => {
  defaultParser(value, existingValue);
  if (value === "off") {
    return 0;
  }
  const numValue = +value;
  if (isNaN(numValue)) {
    throw new Error(`Expected a number`);
  }
  return numValue;
};

const commaSeparatedParser =
  <T>(individualParser: ParserType<T>): ParserType<T[]> =>
  (value, existingValue) => {
    const result = existingValue ?? [];
    result.push(...value.split(",").map((part) => individualParser(part.trim(), undefined)));
    return result;
  };

const commaSeparatedCIDRParser = commaSeparatedParser(parseIpAddressModel);

const propertiesParser: Record<SectionName, { [key: string]: ParserType<any> }> = {
  [interfaceSectionLine]: {
    FwMark: numberParser,
    ListenPort: numberParser,
    PrivateKey: validateWgKey,
    Address: commaSeparatedCIDRParser,
  },
  [peerSectionLine]: {
    AllowedIPs: commaSeparatedCIDRParser,
    Endpoint: defaultParser,
    PersistentKeepalive: numberParser,
    PresharedKey: validateWgKey,
    PublicKey: validateWgKey,
  },
};

export const parseWgConfig = (config: string) => {
  const lines = config.split(lineBreakRegExp);
  const peers: WireguardPeer[] = [];
  const res: WireguardConfig = { peers };
  let foundInterfaceSection = false;
  let currentSection: Record<string, any> | undefined;
  let currentSectionName: SectionName | null = null;

  for (let line of lines) {
    line = line.split("#", 1)[0].trim(); // remove comments
    if (line) {
      if (interfaceSectionLine === line) {
        if (foundInterfaceSection) {
          throw new Error(`Only one [Interface] section is allowed`);
        }
        foundInterfaceSection = true;
        currentSection = res;
        currentSectionName = line;
      } else if (peerSectionLine === line) {
        currentSection = {};
        currentSectionName = line;
        peers.push(currentSection as WireguardPeer);
      } else {
        const match = propertyLine.exec(line);
        if (match) {
          if (!currentSectionName || !currentSection) {
            throw new Error(`Invalid property outside a section`);
          }
          const property = match[1];
          const parser = propertiesParser[currentSectionName][property] ?? unknownPropertyParser;
          const lowerCaseProperty = `${property[0].toLowerCase()}${property.slice(1)}`;
          currentSection[lowerCaseProperty] = parser(match[2], currentSection[lowerCaseProperty]);
        } else {
          throw new Error(`Unrecognized line`);
        }
      }
    }
  }

  // TODO: check that all peers have the required public key and allowed ips fields
  return res;
};
