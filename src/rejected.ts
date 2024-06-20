import type { ProjectDomain, Project } from './types/project';
import { ProjectStatus } from './types/project';
import axios, { type AxiosError } from 'axios';
import { table } from 'table';
import fs from 'fs';

type Body = { results: ProjectDomain[]; next: number | null; }

const result: ProjectDomain[] = [];
const directory: string = 'metrics';

async function fetchProjects(offset: number): Promise<void> {
  console.log(`Fetching projects… (offset=${offset})`);

  return axios.get<Body>('https://eip-tek3.epitest.eu/api/projects/', {
    headers: {
      'Authorization': ['Bearer', process.env.ACCESS_TOKEN].join(' ')
    },
    params: {
      offset,
      scholar_year: 2023,
      include_rejected: true,
      limit: 100
    }
  })
  .then(async res => {
    const body: Body = res.data;

    body.results.forEach(e => {
      if (result.find(r => r.id === e.id))
        return;
      result.push(e);
    });

    if (body.next)
      await fetchProjects(body.next);
  })
  .catch(err => {
    if (!axios.isAxiosError(err))
      console.error(`Fail to fetch projects: ${err}`);

    const axiosError: AxiosError = err;
    switch (axiosError.response?.status) {
      case 401:
        console.error('Invalid access token');
        break;
      default:
        console.error(`Unknown error: ${axiosError.message}`);
        break;
    }
  });
}

async function generateMetrics() {
  await fetchProjects(0);

  try {
    if (!fs.existsSync(directory))
      fs.mkdirSync(directory);
  } catch (e) {
    console.error(`Fail to create ${directory} directory`, e);
  }

  const metrics: Project[] = result.map(e => {
    const ratio: number = e.starsCount > 0 ? (e.starsCount / e.viewsCount * 100) : 0

    return {
      id: e.id,
      name: e.name,
      description: e.description,
      views: e.viewsCount,
      stars: e.starsCount,
      ratio: Math.round(ratio * 100) / 100,
      type: e.envisagedType,
      city: e.ownerCity.name,
      status: e.status
    }
  });

  console.log(table([
    ['Name', 'Type', 'Ville', 'Description', 'Status'],
    ...metrics.map(e => [e.name, e.type, e.city, e.description, e.status])
  ]));
}

generateMetrics();