const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

// Load environment variables from .env file
require('dotenv').config();

const version = packageJson.version;
const tag = `v${version}`;

console.log(`\x1b[36m[Release] Preparing to release version ${version}...\x1b[0m`);

(async () => {
    try {
        // 1. Check if tag exists
        console.log('\x1b[34m[1/4] Checking for existing tag...\x1b[0m');
        try {
            execSync(`git rev-parse ${tag}`, { stdio: 'ignore' });
            console.error(`\x1b[31mError: Tag ${tag} already exists. Please bump the version in package.json first.\x1b[0m`);
            process.exit(1);
        } catch (e) {
            // Tag doesn't exist, proceed
            console.log('      Tag available.');
        }

        // 2. Check git status
        console.log('\x1b[34m[2/4] Checking git status...\x1b[0m');
        const status = execSync('git status --porcelain').toString();
        if (status.length > 0) {
            console.error('\x1b[31mError: Git working directory is not clean. Please commit or stash changes.\x1b[0m');
            console.log(status);
            process.exit(1);
        }

        // Check if pushed to remote
        try {
            execSync('git fetch');
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
            const upstream = execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`).toString().trim();

            // Check if we are ahead of upstream
            const unpushedCount = execSync(`git rev-list --count ${upstream}..HEAD`).toString().trim();

            if (parseInt(unpushedCount) > 0) {
                console.warn(`\x1b[33mWarning: You have ${unpushedCount} unpushed commit(s) on ${currentBranch}. Please push your changes before releasing.\x1b[0m`);
            } else {
                console.log('      Remote is up to date.');
            }
        } catch (e) {
            console.warn('\x1b[33mWarning: Could not verify remote status (no upstream configured?).\x1b[0m');
        }

        // 3. Build
        console.log('\x1b[34m[3/4] Building application...\x1b[0m');
        execSync('npm run build', { stdio: 'inherit' });

        // 4. Publish
        console.log('\x1b[34m[4/4] Publishing release...\x1b[0m');
        //Using electron-builder to publish. It will create the tag and upload assets.
        //GH_TOKEN must be set in environment or user must be logged in to github cli or something I dunno
        //Electron-builder usually needs GH_TOKEN, I think. I don't know how it works.

        console.log('      Running electron-builder --publish always...');
        execSync('npx electron-builder --publish always', { stdio: 'inherit' });

        // 5. Update release description
        console.log('\x1b[34m[5/5] Updating release description...\x1b[0m');
        const releaseBody = `Download and run STFUAI-Podcasts-Setup-${version}.exe to install STFUAI Podcasts.
        
        Join the Discord to give feedback, see full changelog, features, release notifications, etc.
        https://discord.gg/PGJgQV2vzr`;

        // Use GitHub API to update the release
        const https = require('https');
        const updateReleasePromise = new Promise((resolve, reject) => {
            const data = JSON.stringify({
                body: releaseBody
            });

            const options = {
                hostname: 'api.github.com',
                path: `/repos/${packageJson.build.publish.owner}/${packageJson.build.publish.repo}/releases/tags/${tag}`,
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Authorization': `token ${process.env.GH_TOKEN}`,
                    'User-Agent': 'STFUAI-Release-Script'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log('      Release description updated successfully.');
                        resolve();
                    } else {
                        console.warn(`\x1b[33mWarning: Failed to update release description (status ${res.statusCode}). The release was created but without the description.\x1b[0m`);
                        resolve(); // Don't fail the whole release for this
                    }
                });
            });

            req.on('error', (error) => {
                console.warn(`\x1b[33mWarning: Could not update release description: ${error.message}\x1b[0m`);
                resolve(); // Don't fail the whole release for this
            });

            req.write(data);
            req.end();
        });

        // Wait for the update to complete
        await updateReleasePromise;

        console.log(`\x1b[32m[Success] Release ${version} published successfully!\x1b[0m`);

    } catch (error) {
        console.error(`\x1b[31m[Error] Release failed: ${error.message}\x1b[0m`);
        process.exit(1);
    }
})();
