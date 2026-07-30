import bcrypt from 'bcrypt';
import pool from '../connection';

const SALT_ROUNDS = 12;

/**
 * Seeds the database with initial data:
 * - 1 Admin user
 * - 3 test branches
 * - 2 Branch Managers
 * - 2 Sales Staff
 * - Sample stock items
 * - Initial stock levels
 */
export async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create branches
    const branchesResult = await client.query(`
      INSERT INTO branches (id, name, address, contact_number, status) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'Main Branch', '123 Main Street, Metro City', '+1-555-0101', 'Active'),
        ('a0000000-0000-0000-0000-000000000002', 'North Branch', '456 North Avenue, Uptown', '+1-555-0102', 'Active'),
        ('a0000000-0000-0000-0000-000000000003', 'South Branch', '789 South Road, Downtown', '+1-555-0103', 'Active')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

    console.log(`  Seeded ${branchesResult.rowCount} branches`);

    // Create users with hashed passwords
    const adminPassword = await bcrypt.hash('Admin123', SALT_ROUNDS);
    const managerPassword = await bcrypt.hash('Manager123', SALT_ROUNDS);
    const staffPassword = await bcrypt.hash('Staff123', SALT_ROUNDS);

    const usersResult = await client.query(`
      INSERT INTO users (id, username, password_hash, role, assigned_branch_id) VALUES
        ('b0000000-0000-0000-0000-000000000001', 'admin', $1, 'Admin', NULL),
        ('b0000000-0000-0000-0000-000000000002', 'manager_main', $2, 'Branch_Manager', 'a0000000-0000-0000-0000-000000000001'),
        ('b0000000-0000-0000-0000-000000000003', 'manager_north', $2, 'Branch_Manager', 'a0000000-0000-0000-0000-000000000002'),
        ('b0000000-0000-0000-0000-000000000004', 'staff_main', $3, 'Sales_Staff', 'a0000000-0000-0000-0000-000000000001'),
        ('b0000000-0000-0000-0000-000000000005', 'staff_north', $3, 'Sales_Staff', 'a0000000-0000-0000-0000-000000000002')
      ON CONFLICT (id) DO NOTHING
    `, [adminPassword, managerPassword, staffPassword]);

    console.log(`  Seeded ${usersResult.rowCount} users`);

    // Create stock items
    const stockItemsResult = await client.query(`
      INSERT INTO stock_items (id, sku, name, description, category, unit_price, low_stock_threshold) VALUES
        ('c0000000-0000-0000-0000-000000000001', 'ELEC-001', 'Laptop Pro 15', '15-inch professional laptop with 16GB RAM', 'Electronics', 1299.99, 5),
        ('c0000000-0000-0000-0000-000000000002', 'ELEC-002', 'Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 'Electronics', 29.99, 20),
        ('c0000000-0000-0000-0000-000000000003', 'ELEC-003', 'USB-C Hub', '7-in-1 USB-C multiport adapter', 'Electronics', 49.99, 15),
        ('c0000000-0000-0000-0000-000000000004', 'FURN-001', 'Office Chair', 'Ergonomic office chair with lumbar support', 'Furniture', 399.99, 3),
        ('c0000000-0000-0000-0000-000000000005', 'FURN-002', 'Standing Desk', 'Electric height-adjustable standing desk', 'Furniture', 599.99, 2),
        ('c0000000-0000-0000-0000-000000000006', 'STAT-001', 'Notebook Pack', 'Pack of 5 premium A4 notebooks', 'Stationery', 12.99, 50),
        ('c0000000-0000-0000-0000-000000000007', 'STAT-002', 'Pen Set', 'Set of 10 ballpoint pens, black ink', 'Stationery', 8.99, 100),
        ('c0000000-0000-0000-0000-000000000008', 'ELEC-004', 'Monitor 27"', '27-inch 4K IPS display', 'Electronics', 449.99, 4),
        ('c0000000-0000-0000-0000-000000000009', 'ELEC-005', 'Keyboard Mechanical', 'Mechanical keyboard with RGB lighting', 'Electronics', 89.99, 10),
        ('c0000000-0000-0000-0000-000000000010', 'FURN-003', 'Filing Cabinet', '3-drawer steel filing cabinet', 'Furniture', 149.99, 5)
      ON CONFLICT (id) DO NOTHING
    `);

    console.log(`  Seeded ${stockItemsResult.rowCount} stock items`);

    // Create initial stock levels for all branches and items
    const stockLevelsResult = await client.query(`
      INSERT INTO stock_levels (branch_id, stock_item_id, quantity) VALUES
        -- Main Branch stock
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 12),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 45),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 30),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 8),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 4),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 120),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 200),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 6),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 25),
        ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 10),
        -- North Branch stock
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 8),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 30),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 20),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 5),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 2),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 80),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000007', 150),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000008', 3),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009', 15),
        ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000010', 7),
        -- South Branch stock (some items low to trigger alerts)
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 2),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 5),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 10),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 1),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 0),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 10),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007', 30),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000008', 1),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', 3),
        ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000010', 2)
      ON CONFLICT (branch_id, stock_item_id) DO NOTHING
    `);

    console.log(`  Seeded ${stockLevelsResult.rowCount} stock levels`);

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run directly if executed as a script
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seeding complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
