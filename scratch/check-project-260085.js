const { getCostControlData } = require('../database/repos/cost-control');
const { getProjectDashboardData } = require('../database/repos/projects-dashboard');
const fs = require('fs');

async function main() {
  const ccData = await getCostControlData({});
  const prjData = await getProjectDashboardData({});

  const ccProj = ccData.find(p => p.prjId === '260085');
  const prjProj = prjData.find(p => p.prjId === '260085');

  console.log('Cost Control Project 260085:', ccProj);
  console.log('Project Dashboard Project 260085:', prjProj);
}

main().catch(console.error);
