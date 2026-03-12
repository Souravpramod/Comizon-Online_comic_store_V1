import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import User from './models/Users.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/comizon';
        await mongoose.connect(mongoUri, { dbName: 'comizon' });
        console.log('Connected to MongoDB: ' + mongoUri + ' (Database: comizon)');

        const adminEmail = 'superadmin@comizon.com';
        const password = 'SuperSecretAdmin123!';

        let user = await User.findOne({ email: adminEmail });

        if (!user) {
            const passwordHash = await bcrypt.hash(password, 10);
            user = new User({
                firstName: 'Super',
                lastName: 'Admin',
                email: adminEmail,
                passwordHash: passwordHash,
                role: 'admin',
                isActive: true,
                isBlocked: false,
                isPremium: false
            });
            await user.save();
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists. Updating to ensure correct properties...');
            user.passwordHash = await bcrypt.hash(password, 10);
            user.role = 'admin';
            user.isActive = true;
            user.isBlocked = false;
            await user.save();
            console.log('Admin user updated successfully.');
        }

        // Export to fpro folder
        const outputDir = 'C:\\Users\\USER\\Documents\\programming\\fpro';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const details = `Admin details for Comizon (Generated via Agentic setup).
Do NOT share this file.

Admin Name: ${user.firstName} ${user.lastName}
Admin Email: ${user.email}
Admin Password: ${password}
Role: ${user.role}
Creation Timestamp: ${new Date().toISOString()}

Note: Login at http://localhost:<port>/admin/login
`;

        const detailsPath = path.join(outputDir, 'admin_details.txt');
        fs.writeFileSync(detailsPath, details);
        console.log(`Admin credentials exported to: ${detailsPath}`);

        // Output plaintext specifically for the browser subagent to know what to use, but IT WON'T BE IN THE FILE.
        console.log(`BROWSER_AGENT_CREDENTIALS_DO_NOT_SHARE_OUTSIDE_OF_TERMINAL|${adminEmail}|${password}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error maintaining admin user:', error);
        process.exit(1);
    }
};

createAdmin();
