const https = require('https');

const URL = process.argv[2] || 'http://localhost:3000';
console.log(`\n🚀 Testing Deployment at: ${URL}\n`);

async function test(path, options = {}) {
    return new Promise((resolve) => {
        const fullUrl = `${URL}${path}`;
        console.log(`Testing ${options.method || 'GET'} ${path}...`);

        const req = https.request(fullUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`  Status: ${res.statusCode}`);
                resolve({ status: res.statusCode, body: data });
            });
        });

        req.on('error', (e) => {
            // Fallback to http if https fails (for localhost)
            if (URL.startsWith('http://')) {
                const http = require('http');
                const httpReq = http.request(fullUrl, options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        console.log(`  Status: ${res.statusCode}`);
                        resolve({ status: res.statusCode, body: data });
                    });
                });
                httpReq.end();
            } else {
                console.error(`  Error: ${e.message}`);
                resolve({ error: e.message });
            }
        });

        if (options.body) req.write(options.body);
        req.end();
    });
}

async function runTests() {
    // Test 1: Homepage
    const home = await test('/');
    if (home.status === 200) console.log('  ✅ Homepage is UP');
    else console.log('  ❌ Homepage failed');

    console.log('');

    // Test 2: Interactions GET
    const interactionsGet = await test('/api/interactions');
    if (interactionsGet.status === 200 && interactionsGet.body.includes('active')) {
        console.log('  ✅ Interactions GET is working (Debug route)');
    } else {
        console.log('  ❌ Interactions GET failed');
    }

    console.log('');

    // Test 3: Interactions POST (Should be 401 Unauthorized without signature)
    const interactionsPost = await test('/api/interactions', {
        method: 'POST',
        body: JSON.stringify({ type: 1 })
    });
    if (interactionsPost.status === 401) {
        console.log('  ✅ Interactions POST security is working (Returned 401)');
    } else {
        console.log(`  ❌ Interactions POST security check failed (Returned ${interactionsPost.status})`);
    }

    console.log('\n✨ Testing Complete!\n');
}

runTests();
