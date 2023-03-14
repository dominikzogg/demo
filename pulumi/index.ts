import * as pulumi from '@pulumi/pulumi';
import * as digitalocean from '@pulumi/digitalocean';
import * as docker from '@pulumi/docker';
import { realpathSync } from 'fs';

type createContainerRegistryProps = {
  region: digitalocean.Region;
  stack: string;
};

export const createContainerRegistry = ({
  region,
  stack,
}: createContainerRegistryProps): digitalocean.ContainerRegistry => {
  if (stack !== 'staging') {
    const staging = new pulumi.StackReference('business/project/staging');

    return digitalocean.ContainerRegistry.get('container-registry', staging.getOutput('containerRegistryId'));
  }

  return new digitalocean.ContainerRegistry('container-registry', {
    subscriptionTierSlug: 'professional',
    region,
  });
};

type CreateContainerRegistryDockerReadWriteCredentials = {
  containerRegistry: digitalocean.ContainerRegistry;
};

export const createContainerRegistryDockerReadWriteCredentials = ({
  containerRegistry,
}: CreateContainerRegistryDockerReadWriteCredentials): digitalocean.ContainerRegistryDockerCredentials => {
  return new digitalocean.ContainerRegistryDockerCredentials('container-registry-credentials-read-write', {
    registryName: containerRegistry.name,
    write: true,
  });
};

type DockerCredentials = {
  auths: {
    [host: string]: {
      auth: string;
    };
  };
};

type CreateAndPushImageProps = {
  context: string;
  name: string;
  containerRegistry: digitalocean.ContainerRegistry;
  containerRegistryDockerReadWriteCredentials: digitalocean.ContainerRegistryDockerCredentials;
  type: string;
  subType?: string;
  args?: pulumi.Input<Record<string, pulumi.Input<string>>>;
};

export const createAndPushImage = ({
  context,
  name,
  containerRegistry,
  containerRegistryDockerReadWriteCredentials,
  type,
  subType,
  args,
}: CreateAndPushImageProps): pulumi.Output<string> => {
  const localImageName = `${name}${subType ? `-${subType}` : ''}`;
  const imageName = pulumi.interpolate`${containerRegistry.endpoint}/${localImageName}`;

  return containerRegistryDockerReadWriteCredentials.dockerCredentials.apply((dockerCredentials) => {
    const parsedDockerCredentials = JSON.parse(dockerCredentials) as DockerCredentials;

    const server = Object.keys(parsedDockerCredentials.auths)[0];
    const auth = parsedDockerCredentials.auths[server].auth;
    const username = Buffer.from(auth, 'base64').toString('utf-8').split(':')[0];
    const password = username;

    const image = new docker.Image(localImageName, {
      imageName,
      build: {
        context,
        dockerfile: `${type}/docker/production${subType ? `/${subType}` : ''}/Dockerfile`,
        args,
      },
      registry: {
        server,
        username,
        password,
      },
    });

    return (image.imageName) as unknown as string;
  });
};

const context = realpathSync(`${process.cwd()}/../`);

const region = digitalocean.Region.FRA1;
const stack = pulumi.getStack();

const containerRegistry = createContainerRegistry({ region, stack });
const containerRegistryDockerReadWriteCredentials = createContainerRegistryDockerReadWriteCredentials({
  containerRegistry,
});

createAndPushImage({
  context,
  type: 'project',
  name: 'project-1',
  containerRegistry,
  containerRegistryDockerReadWriteCredentials,
});
