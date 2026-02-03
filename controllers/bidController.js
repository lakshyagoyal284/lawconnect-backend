import pool from '../config/db.js';

// @desc    Create new bid
// @route   POST /api/bids
// @access  Private
export const createBid = async (req, res) => {
  try {
    const { case_id, amount, message, currency } = req.body;
    
    // Only lawyers can create bids
    if (req.user.role !== 'lawyer') {
      return res.status(403).json({ message: 'Only lawyers can submit bids' });
    }

    // Check if case exists and is open
    const [cases] = await pool.execute('SELECT * FROM cases WHERE id = ? AND status = ?', [case_id, 'open']);
    if (cases.length === 0) {
      return res.status(400).json({ message: 'Case not found or not open for bidding' });
    }

    // Check if lawyer already bid on this case
    const [existingBids] = await pool.execute(
      'SELECT * FROM bids WHERE case_id = ? AND lawyer_id = ?',
      [case_id, req.user.id]
    );
    if (existingBids.length > 0) {
      return res.status(400).json({ message: 'You have already bid on this case' });
    }

    const query = `
      INSERT INTO bids (case_id, lawyer_id, amount, currency, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NOW())
    `;
    
    const [result] = await pool.execute(query, [case_id, req.user.id, amount, currency || 'USD', message]);
    
    // Get the created bid
    const [newBid] = await pool.execute('SELECT * FROM bids WHERE id = ?', [result.insertId]);
    
    res.status(201).json(newBid[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get bids for a case
// @route   GET /api/bids/case/:caseId
// @access  Private
export const getBidsByCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const query = `
      SELECT b.*, u.name as lawyer_name, u.email as lawyer_email
      FROM bids b
      JOIN users u ON b.lawyer_id = u.id
      WHERE b.case_id = ?
      ORDER BY b.created_at DESC
    `;
    
    const [bids] = await pool.execute(query, [caseId]);
    res.json(bids);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update bid status
// @route   PUT /api/bids/:id/status
// @access  Private
export const updateBidStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log('Updating bid status:', { id, status, user: req.user });
    
    // Get bid with case details
    const [bids] = await pool.execute(`
      SELECT b.*, c.user_id as case_owner_id
      FROM bids b
      JOIN cases c ON b.case_id = c.id
      WHERE b.id = ?
    `, [id]);
    
    if (bids.length === 0) {
      console.log('Bid not found:', id);
      return res.status(404).json({ message: 'Bid not found' });
    }
    
    const bid = bids[0];
    console.log('Found bid:', bid);
    
    // Only case owner can accept/reject bids
    if (bid.case_owner_id !== req.user.id) {
      console.log('Permission denied: case_owner_id:', bid.case_owner_id, 'user_id:', req.user.id);
      return res.status(403).json({ message: 'Only case owner can update bid status' });
    }
    
    // Update bid status
    await pool.execute(
      'UPDATE bids SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    
    console.log('Bid status updated to:', status);
    
    // If bid is accepted, update case status
    if (status === 'accepted') {
      await pool.execute(
        'UPDATE cases SET status = ?, updated_at = NOW() WHERE id = ?',
        ['in_progress', bid.case_id]
      );
      
      console.log('Case status updated to in_progress');
      
      // Reject all other bids for this case
      await pool.execute(
        'UPDATE bids SET status = ? WHERE case_id = ? AND id != ?',
        ['rejected', bid.case_id, id]
      );
      
      console.log('Other bids rejected');
    }
    
    res.json({ message: `Bid ${status} successfully` });
  } catch (error) {
    console.error('Error updating bid status:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
