

contract RegistryMock {
    mapping(bytes32 => address) private _domainOwners;
    mapping(bytes32 => bool) private _domainExists;

    mapping(string resolverType => address resolver) internal resolvers;

    mapping(bytes32 domainHash => DomainRecord domainRecord) internal records;

    mapping(address owner => mapping(address operator => bool isOperator));

    constructor() {}

    function setDomainOwner(bytes32 domainHash, address owner) external {
        _domainOwners[domainHash] = owner;
        _domainExists[domainHash] = true;
    }

    function exists(bytes32 domainHash) external view returns (bool) {
        return _domainExists[domainHash];
    }

    function getDomainOwner(bytes32 domainHash) external view returns (address) {
        return _domainOwners[domainHash];
    }
}