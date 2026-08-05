import mongoose from 'mongoose';

let isConnected = false;

export const isDBConnected = (): boolean => isConnected;

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/foodlens';

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    isConnected = false;
    console.warn(
      '⚠️  MongoDB connection failed — server will start without DB.',
      '\n   Food analysis will still work but results won\'t be saved.',
      '\n   Fix: Check Atlas credentials and IP whitelist.',
      '\n   Error:', (error as Error).message
    );
    // Do NOT throw — let the server start without MongoDB
  }
};

